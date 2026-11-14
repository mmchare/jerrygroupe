import { describe, expect, it } from "vitest";

import { createRateLimiter, isAcceptableQuestion, trimHistory } from "@/lib/chat/chat-rules";

const msg = (role: "user" | "assistant", text: string) => ({ role, parts: [{ type: "text", text }] });

describe("site assistant limits", () => {
  it("accepts a question of 1500 characters and rejects 1501", () => {
    expect(isAcceptableQuestion([msg("user", "a".repeat(1500))])).toBe(true);
    expect(isAcceptableQuestion([msg("user", "a".repeat(1501))])).toBe(false);
  });

  it("rejects an empty question or one that is not from the visitor", () => {
    expect(isAcceptableQuestion([msg("user", "   ")])).toBe(false);
    expect(isAcceptableQuestion([msg("user", "hi"), msg("assistant", "hello")])).toBe(false);
  });

  it("keeps only the last 20 messages, starting with a visitor message", () => {
    const history = Array.from({ length: 25 }, (_, i) => msg(i % 2 === 0 ? "user" : "assistant", `m${i}`));
    const trimmed = trimHistory(history);
    expect(trimmed.length).toBeLessThanOrEqual(20);
    expect(trimmed[0]?.role).toBe("user");
    expect(trimmed.at(-1)?.parts[0]?.text).toBe("m24");
  });

  it("allows 20 questions per visitor in 10 minutes, then blocks", () => {
    const allow = createRateLimiter();
    const start = 1_000_000;
    for (let i = 0; i < 20; i++) expect(allow("ip", start + i)).toBe(true);
    expect(allow("ip", start + 21)).toBe(false);
    expect(allow("other-ip", start + 21)).toBe(true);
    expect(allow("ip", start + 10 * 60 * 1000 + 1)).toBe(true);
  });
});
