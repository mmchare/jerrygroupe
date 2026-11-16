import { describe, expect, it } from "vitest";

import { CONTACT_INBOX, contactFieldErrors, isContactRateLimited } from "@/lib/contact-rules";

const valid = {
  clientMessageId: "7b0f6a52-4b1e-4c0e-9f3a-1c2d3e4f5a6b",
  fullName: "Jane Doe",
  email: "jane@example.com",
  subject: "Partnership",
  message: "We would like to discuss a partnership.",
  language: "en",
};

describe("contact form rules", () => {
  it("delivers to contact@jerrytradinggroup.com", () => {
    expect(CONTACT_INBOX).toBe("contact@jerrytradinggroup.com");
  });
  it("accepts a complete message", () => {
    expect(contactFieldErrors(valid)).toBeNull();
  });
  it("rejects an invalid email and an empty message", () => {
    expect(contactFieldErrors({ ...valid, email: "nope", message: "" })).toEqual({ email: "email", message: "tooShort" });
  });
  it("rejects messages over 5000 characters", () => {
    expect(contactFieldErrors({ ...valid, message: "a".repeat(5001) })).toEqual({ message: "tooLong" });
  });
  it("limits 5 messages per hour per visitor and 5 per day per email", () => {
    expect(isContactRateLimited(4, 4)).toBe(false);
    expect(isContactRateLimited(5, 0)).toBe(true);
    expect(isContactRateLimited(0, 5)).toBe(true);
  });
});
