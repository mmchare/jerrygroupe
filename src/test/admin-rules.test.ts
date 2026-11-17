import { describe, expect, it } from "vitest";

import {
  ADMIN_DOCUMENT_MAX_BYTES,
  adminDocumentProblem,
  adminStatusSchema,
  filterAdminProposals,
  nextDocumentVersion,
} from "@/lib/admin-rules";

const validStatus = {
  proposalId: "123e4567-e89b-12d3-a456-426614174000",
  status: "additional_info_required",
  internalNote: "",
  supplierMessage: "Please send the missing certificate.",
};

describe("administration rules", () => {
  it("requires a supplier message when requesting additional information", () => {
    expect(adminStatusSchema.safeParse({ ...validStatus, supplierMessage: "" }).success).toBe(false);
    expect(adminStatusSchema.safeParse(validStatus).success).toBe(true);
  });

  it("accepts PDF documents up to 20 MiB and rejects other formats", () => {
    expect(adminDocumentProblem({ name: "contract.pdf", size: ADMIN_DOCUMENT_MAX_BYTES, type: "application/pdf" })).toBeNull();
    expect(adminDocumentProblem({ name: "contract.docx", size: 1000, type: "application/msword" })).toBe("fileType");
    expect(adminDocumentProblem({ name: "contract.pdf", size: ADMIN_DOCUMENT_MAX_BYTES + 1, type: "application/pdf" })).toBe("fileSize");
  });

  it("creates the next version after the highest existing version", () => {
    expect(nextDocumentVersion([])).toBe(1);
    expect(nextDocumentVersion([1, 3, 2])).toBe(4);
  });

  it("finds proposals by reference, contact or title without exposing other rows", () => {
    const rows = [
      { reference: "JG-PRP-2026-000001", full_name: "Alice", company_name: "Alpha", email: "alice@example.com", title: "Gold" },
      { reference: "JG-PRP-2026-000002", full_name: "Bob", company_name: null, email: "bob@example.com", title: "Marine" },
    ];
    expect(filterAdminProposals(rows, "000002").map((row) => row.reference)).toEqual(["JG-PRP-2026-000002"]);
    expect(filterAdminProposals(rows, "alpha").map((row) => row.reference)).toEqual(["JG-PRP-2026-000001"]);
    expect(filterAdminProposals(rows, "")).toHaveLength(2);
  });
});
