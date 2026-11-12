import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

/**
 * Shared proposal rules, used by the browser form and re-checked by the server.
 * Error messages are translation keys from the `errors` dictionary section.
 */

export const PROPOSER_TYPES = ["individual", "company", "cooperative", "other"] as const;
export const UNITS = [
  "kg",
  "tonne",
  "gram",
  "ounce",
  "carat",
  "litre",
  "barrel",
  "cubic_metre",
  "piece",
  "lot",
  "other",
] as const;
export const CONDITIONS = [
  "new",
  "excellent",
  "good",
  "fair",
  "to_restore",
  "raw",
  "processed",
  "not_applicable",
] as const;
export const AVAILABILITY = [
  "immediate",
  "within_30_days",
  "within_90_days",
  "seasonal",
  "on_request",
] as const;
export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "AED",
  "QAR",
  "SAR",
  "CNY",
  "JPY",
  "KRW",
  "HKD",
  "SGD",
  "CAD",
  "AUD",
  "NZD",
  "ZAR",
  "KES",
  "EGP",
  "NGN",
  "XOF",
  "XAF",
  "MAD",
  "INR",
] as const;

/** Allowed attachment extensions and the MIME types each may carry. */
export const ALLOWED_FILE_TYPES: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heif", "image/heic"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

export const DEFAULT_MAX_FILE_MB = 20;
export const DEFAULT_MAX_FILES = 10;
/** The storage bucket rejects anything above this, whatever the admin setting says. */
export const HARD_MAX_FILE_MB = 25;

export type AttachmentError = "fileType" | "fileSize" | "fileEmpty";

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Checks extension, MIME type (when the browser reports one) and size. */
export function checkAttachment(
  file: { name: string; size: number; type: string },
  maxMb: number,
): AttachmentError | null {
  const ext = fileExtension(file.name);
  const allowed = ALLOWED_FILE_TYPES[ext];
  if (!allowed) return "fileType";
  const mime = file.type.toLowerCase();
  if (mime && !allowed.includes(mime)) return "fileType";
  if (file.size <= 0) return "fileEmpty";
  const limit = Math.min(maxMb, HARD_MAX_FILE_MB) * 1024 * 1024;
  if (file.size > limit) return "fileSize";
  return null;
}

/* ---------------- Category-specific fields (configured in the database) ---------------- */

export type ExtraFieldOption = { value: string; label_en: string; label_fr: string };
export type ExtraField = {
  key: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  label_en: string;
  label_fr: string;
  options?: ExtraFieldOption[];
};

export function parseExtraFields(raw: unknown): ExtraField[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is ExtraField =>
      !!f &&
      typeof f === "object" &&
      typeof (f as ExtraField).key === "string" &&
      ["text", "textarea", "select"].includes((f as ExtraField).type),
  );
}

export const EXTRA_TEXT_MAX = 500;
export const EXTRA_TEXTAREA_MAX = 3000;

/** Validates answers against the category configuration and drops unknown keys. */
export function validateExtraAnswers(
  fields: ExtraField[],
  answers: Record<string, unknown>,
): { clean: Record<string, string>; errors: Record<string, "required" | "option" | "tooLong"> } {
  const clean: Record<string, string> = {};
  const errors: Record<string, "required" | "option" | "tooLong"> = {};
  for (const field of fields) {
    const raw = answers[field.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (field.required) errors[field.key] = "required";
      continue;
    }
    if (field.type === "select" && !field.options?.some((o) => o.value === value)) {
      errors[field.key] = "option";
      continue;
    }
    const max = field.type === "textarea" ? EXTRA_TEXTAREA_MAX : EXTRA_TEXT_MAX;
    if (value.length > max) {
      errors[field.key] = "tooLong";
      continue;
    }
    clean[field.key] = value;
  }
  return { clean, errors };
}

/* ---------------- Submission payload (what the server accepts) ---------------- */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

const countryCode = z.string().regex(/^[A-Z]{2}$/, "option");

export const proposalPayloadSchema = z.object({
  clientSubmissionId: z.string().uuid(),
  submissionLanguage: z.enum(["en", "fr"]),
  // Step 1
  proposerType: z.enum(PROPOSER_TYPES, { errorMap: () => ({ message: "required" }) }),
  fullName: z.string().trim().min(2, "required").max(150, "tooLong"),
  companyName: optionalText(200),
  countryCode,
  city: z.string().trim().min(1, "required").max(120, "tooLong"),
  email: z.string().trim().min(1, "required").email("email").max(255, "tooLong"),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => /^\+[1-9]\d{6,14}$/.test(v) && isValidPhoneNumber(v), "phone"),
  preferredLanguage: z.enum(["en", "fr"]),
  // Step 2
  categoryId: z.string().uuid("required"),
  title: z.string().trim().min(2, "required").max(200, "tooLong"),
  description: z.string().trim().min(20, "tooShort").max(5000, "tooLong"),
  originCountryCode: countryCode.optional(),
  quantity: z.number().nonnegative("number").finite("number").optional(),
  unit: z.enum(UNITS).optional(),
  askingPrice: z.number().nonnegative("number").finite("number").optional(),
  currency: z.enum(CURRENCIES).optional(),
  productCondition: z.enum(CONDITIONS).optional(),
  availability: z.enum(AVAILABILITY).optional(),
  deliveryLocation: optionalText(200),
  additionalInfo: optionalText(3000),
  extraAnswers: z.record(z.string().max(EXTRA_TEXTAREA_MAX + 100)).default({}),
  // Step 3
  attachments: z
    .array(
      z.object({
        path: z.string().min(1).max(300),
        originalName: z.string().trim().min(1).max(200),
      }),
    )
    .max(DEFAULT_MAX_FILES * 2)
    .default([]),
  // Step 4
  declarationAccepted: z.literal(true, { errorMap: () => ({ message: "declaration" }) }),
  // Anti-spam honeypot: real visitors never fill it.
  website: z.string().max(0).optional(),
});

export type ProposalPayload = z.infer<typeof proposalPayloadSchema>;

/** Proposal references look like JG-PRP-2026-000001. */
export const PROPOSAL_REFERENCE_PATTERN = /^JG-PRP-\d{4}-\d{6}$/;

/** Storage folder holding a submission's files before and after it is sent. */
export function attachmentFolder(clientSubmissionId: string): string {
  return `submissions/${clientSubmissionId}`;
}
