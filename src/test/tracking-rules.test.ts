import { describe, expect, it } from "vitest";

import {
  canSupplierReply,
  contactMatches,
  generateToken,
  isDocumentListed,
  isDocumentOpenable,
  isTokenUsable,
  isVerificationLocked,
  normalizeReference,
  parseContactProof,
  TOKEN_PATTERN,
} from "@/lib/tracking-rules";

const stored = { email: "Supplier@Example.com", whatsapp_e164: "+254712345678" };

describe("Track Your Proposal — verification", () => {
  it("normalizes a reference typed in lower case with spaces", () => {
    expect(normalizeReference(" jg-prp-2026-000001 ")).toBe("JG-PRP-2026-000001");
  });

  it("accepts the submission email regardless of letter case", () => {
    expect(contactMatches(parseContactProof("supplier@example.COM"), stored)).toBe(true);
  });

  it("accepts the WhatsApp number written with spaces or a 00 prefix", () => {
    expect(contactMatches(parseContactProof("+254 712 345 678"), stored)).toBe(true);
    expect(contactMatches(parseContactProof("00254712345678"), stored)).toBe(true);
  });

  it("refuses a different email or number", () => {
    expect(contactMatches(parseContactProof("other@example.com"), stored)).toBe(false);
    expect(contactMatches(parseContactProof("+254712345679"), stored)).toBe(false);
  });

  it("never treats the reference alone as proof", () => {
    expect(contactMatches(parseContactProof(""), stored)).toBe(false);
    expect(contactMatches(parseContactProof("JG-PRP-2026-000001"), stored)).toBe(false);
  });

  it("locks after 5 failures on one reference or 10 from one connection within the hour", () => {
    expect(isVerificationLocked(0, 4)).toBe(false);
    expect(isVerificationLocked(0, 5)).toBe(true);
    expect(isVerificationLocked(9, 0)).toBe(false);
    expect(isVerificationLocked(10, 0)).toBe(true);
  });

  it("rejects expired or revoked access links", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(isTokenUsable({ expires_at: "2026-06-01T13:00:00Z", revoked_at: null }, now)).toBe(true);
    expect(isTokenUsable({ expires_at: "2026-06-01T11:59:59Z", revoked_at: null }, now)).toBe(false);
    expect(isTokenUsable({ expires_at: "2026-06-02T00:00:00Z", revoked_at: "2026-06-01T10:00:00Z" }, now)).toBe(false);
  });

  it("generates unguessable 256-bit tokens", () => {
    const a = generateToken();
    expect(a).toMatch(TOKEN_PATTERN);
    expect(generateToken()).not.toBe(a);
  });
});

describe("Supplier Document Center — access", () => {
  it("never opens a revoked or draft document", () => {
    expect(isDocumentOpenable("revoked")).toBe(false);
    expect(isDocumentOpenable("draft")).toBe(false);
  });

  it("keeps earlier versions available", () => {
    expect(isDocumentOpenable("published")).toBe(true);
    expect(isDocumentOpenable("superseded")).toBe(true);
  });

  it("hides drafts from the supplier", () => {
    expect(isDocumentListed("draft")).toBe(false);
  });
});

describe("Additional information", () => {
  it("lets the supplier reply only when information has been requested", () => {
    expect(canSupplierReply("additional_info_required")).toBe(true);
    expect(canSupplierReply("under_review")).toBe(false);
    expect(canSupplierReply("approved")).toBe(false);
  });
});
