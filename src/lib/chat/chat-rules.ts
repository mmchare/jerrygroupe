/** Limits that keep the public site assistant fast, focused and protected from abuse. */
export const CHAT_MAX_HISTORY = 20;
export const CHAT_MAX_MESSAGE_CHARS = 1500;
export const CHAT_RATE_LIMIT = 20;
export const CHAT_RATE_WINDOW_MS = 10 * 60 * 1000;

type TextLike = { role: string; parts: ReadonlyArray<{ type: string; text?: string }> };

export function messageText(message: TextLike): string {
  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

/** Only the most recent turns are sent to the model; it must start with a visitor message. */
export function trimHistory<T extends TextLike>(messages: T[], max = CHAT_MAX_HISTORY): T[] {
  const recent = messages.slice(-max);
  const firstUser = recent.findIndex((m) => m.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

/** The latest visitor message must exist and stay within the length limit. */
export function isAcceptableQuestion(messages: TextLike[]): boolean {
  const last = messages.at(-1);
  if (!last || last.role !== "user") return false;
  const text = messageText(last).trim();
  return text.length > 0 && text.length <= CHAT_MAX_MESSAGE_CHARS;
}

/** Sliding-window counter per visitor; returns false once the limit is reached. */
export function createRateLimiter(limit = CHAT_RATE_LIMIT, windowMs = CHAT_RATE_WINDOW_MS) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

export const RELAY_SECRET_HEADER = "x-jg-relay-secret";
export const RELAY_VISITOR_HEADER = "x-jg-visitor-ip";

/** Constant-time comparison so the relay secret can't be guessed byte by byte. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Who is asking, for rate limiting. A trusted relay (another copy of the site holding the shared
 * secret) may pass on the real visitor address; anyone else is identified by their own address.
 */
export function resolveVisitorKey(headers: Headers, relaySecret: string | undefined): string {
  const own =
    headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const forwarded = headers.get(RELAY_VISITOR_HEADER)?.trim();
  if (forwarded && relaySecret && sameSecret(headers.get(RELAY_SECRET_HEADER) ?? "", relaySecret)) {
    return `relay:${forwarded}`;
  }
  return own;
}
