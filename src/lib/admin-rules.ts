import { z } from "zod";

import { DOCUMENT_TYPES, PROPOSAL_STATUSES } from "./tracking-rules";

export const ADMIN_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const ADMIN_DOCUMENT_MIME = "application/pdf";

export const adminListSchema = z.object({
  search: z.string().trim().max(200).optional().default(""),
  status: z.enum(PROPOSAL_STATUSES).optional(),
});

export const adminStatusSchema = z
  .object({
    proposalId: z.string().uuid(),
    status: z.enum(PROPOSAL_STATUSES),
    internalNote: z.string().trim().max(5000).optional().default(""),
    supplierMessage: z.string().trim().max(5000).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.status === "additional_info_required" && value.supplierMessage.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supplierMessage"],
        message: "A supplier message is required when additional information is requested.",
      });
    }
  });

export const adminMessageSchema = z.object({
  proposalId: z.string().uuid(),
  body: z.string().trim().min(2).max(5000),
});

export const adminDocumentUploadSchema = z.object({
  proposalId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(ADMIN_DOCUMENT_MAX_BYTES),
  mimeType: z.string().max(150),
});

export const adminDocumentSchema = z.object({
  proposalId: z.string().uuid(),
  groupId: z.string().uuid().optional(),
  docType: z.enum(DOCUMENT_TYPES),
  reference: z.string().trim().min(1).max(60),
  titleEn: z.string().trim().max(200).optional().default(""),
  titleFr: z.string().trim().max(200).optional().default(""),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  path: z.string().max(400),
  fileName: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(ADMIN_DOCUMENT_MAX_BYTES),
  mimeType: z.string().max(150),
});

export function adminDocumentProblem(file: { name: string; size: number; type: string }) {
  if (file.size <= 0) return "fileEmpty" as const;
  if (file.size > ADMIN_DOCUMENT_MAX_BYTES) return "fileSize" as const;
  if (!file.name.toLowerCase().endsWith(".pdf")) return "fileType" as const;
  if (file.type && file.type.toLowerCase() !== ADMIN_DOCUMENT_MIME) return "fileType" as const;
  return null;
}

export function nextDocumentVersion(versions: number[]): number {
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

export function filterAdminProposals<
  T extends { reference: string; full_name: string; company_name: string | null; email: string; title: string },
>(rows: T[], search: string): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) =>
    [row.reference, row.full_name, row.company_name ?? "", row.email, row.title]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}
