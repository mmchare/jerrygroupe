import { z } from "zod";

/** Inbox that receives every message sent from the Contact page. */
export const CONTACT_INBOX = "contact@jerrytradinggroup.com";
export const MAX_CONTACT_PER_IP_PER_HOUR = 5;
export const MAX_CONTACT_PER_EMAIL_PER_DAY = 5;

export const contactMessageSchema = z.object({
  clientMessageId: z.string().uuid(),
  fullName: z.string().trim().min(2, "required").max(120, "tooLong"),
  email: z.string().trim().min(1, "required").email("email").max(200, "tooLong"),
  companyName: z
    .string()
    .trim()
    .max(160, "tooLong")
    .optional()
    .transform((v) => (v ? v : undefined)),
  subject: z.string().trim().min(3, "tooShort").max(160, "tooLong"),
  message: z.string().trim().min(10, "tooShort").max(5000, "tooLong"),
  language: z.enum(["en", "fr"]),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactMessageInput = z.input<typeof contactMessageSchema>;
export type ContactFieldError = "required" | "email" | "tooLong" | "tooShort";

/** Field-level errors keyed by field name, or null when the message is valid. */
export function contactFieldErrors(input: unknown): Record<string, ContactFieldError> | null {
  const parsed = contactMessageSchema.safeParse(input);
  if (parsed.success) return null;
  const out: Record<string, ContactFieldError> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = (["required", "email", "tooLong", "tooShort"].includes(issue.message) ? issue.message : "required") as ContactFieldError;
  }
  return out;
}

export function isContactRateLimited(sentLastHourFromIp: number, sentLastDayFromEmail: number) {
  return sentLastHourFromIp >= MAX_CONTACT_PER_IP_PER_HOUR || sentLastDayFromEmail >= MAX_CONTACT_PER_EMAIL_PER_DAY;
}
