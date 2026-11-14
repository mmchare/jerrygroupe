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
