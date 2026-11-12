import { describe, expect, it } from "vitest";

import { checkAttachment, validateExtraAnswers, PROPOSAL_REFERENCE_PATTERN } from "@/lib/proposal-rules";

describe("proposal rules", () => {
  it("rejects files above the configured size limit", () => {
    expect(checkAttachment({ name: "a.pdf", size: 21 * 1024 * 1024, type: "application/pdf" }, 20)).toBe("fileSize");
  });
  it("rejects disallowed extensions and mismatched MIME types", () => {
    expect(checkAttachment({ name: "run.exe", size: 10, type: "application/octet-stream" }, 20)).toBe("fileType");
    expect(checkAttachment({ name: "photo.jpg", size: 10, type: "application/pdf" }, 20)).toBe("fileType");
  });
  it("requires category fields marked as required", () => {
    const fields = [{ key: "product_state", type: "select" as const, required: true, label_en: "", label_fr: "", options: [{ value: "dried", label_en: "", label_fr: "" }] }];
    expect(validateExtraAnswers(fields, {}).errors["product_state"]).toBe("required");
    expect(validateExtraAnswers(fields, { product_state: "frozen" }).errors["product_state"]).toBe("option");
  });
  it("uses the JG-PRP-YYYY-NNNNNN reference format", () => {
    expect(PROPOSAL_REFERENCE_PATTERN.test("JG-PRP-2026-000001")).toBe(true);
    expect(PROPOSAL_REFERENCE_PATTERN.test("JG-PRP-26-1")).toBe(false);
  });
});
