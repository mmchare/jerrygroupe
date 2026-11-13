import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

/**
 * Shared rules for "Track Your Proposal" and the Supplier Document Center.
 * Pure functions: used by the server and covered by tests.
 */

export const PROPOSAL_STATUSES = [
  "received",
  "under_review",
  "additional_info_required",
  "under_negotiation",
  "approved_in_principle",
  "approved",
  "rejected",
  "purchase_order_issued",
  "completed",
  "archived",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "purchase_order",
  "contract",
  "invoice",
  "delivery_document",
  "payment_receipt",
  "amendment",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus = "draft" | "published" | "superseded" | "revoked";

/** A verified session lasts two hours; the individual link given at submission lasts one year. */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const LINK_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** Signed file links expire quickly so a shared URL stops working. */
export const SIGNED_URL_TTL_SECONDS = 120;

/** Failed verification limits, counted over the last hour. */
export const MAX_FAILED_PER_IP_PER_HOUR = 10;
export const MAX_FAILED_PER_REFERENCE_PER_HOUR = 5;

/** Supplier replies. */
export const MAX_REPLIES_PER_DAY = 10;
export const MAX_REPLY_FILES = 10;

export const REFERENCE_PATTERN = /^JG-PRP-\d{4}-\d{6}$/;

/** Uppercases, trims and removes inner spaces: " jg-prp-2026-000001 " -> "JG-PRP-2026-000001". */
export function normalizeReference(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "").replace(/[‐-―]/g, "-");
}

export type ContactProof = { kind: "email"; value: string } | { kind: "whatsapp"; value: string } | null;

/** Reads the second verification factor: the email or the WhatsApp number used at submission. */
export function parseContactProof(input: string): ContactProof {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    return z.string().email().max(255).safeParse(email).success ? { kind: "email", value: email } : null;
  }
  const compact = raw.replace(/[\s().-]/g, "");
  const withPlus = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (!withPlus.startsWith("+")) return null;
  const phone = parsePhoneNumberFromString(withPlus);
  return phone?.isValid() ? { kind: "whatsapp", value: phone.number } : null;
}

/** True when the proof matches the contact details stored with the proposal. */
export function contactMatches(proof: ContactProof, stored: { email: string; whatsapp_e164: string }): boolean {
  if (!proof) return false;
  if (proof.kind === "email") return stored.email.trim().toLowerCase() === proof.value;
  return stored.whatsapp_e164 === proof.value;
}

/** Verification is refused while too many recent attempts have failed. */
export function isVerificationLocked(failedFromIp: number, failedForReference: number): boolean {
  return failedFromIp >= MAX_FAILED_PER_IP_PER_HOUR || failedForReference >= MAX_FAILED_PER_REFERENCE_PER_HOUR;
}

/** A token is usable when it is neither revoked nor expired. */
export function isTokenUsable(token: { expires_at: string; revoked_at: string | null }, now = new Date()): boolean {
  return !token.revoked_at && new Date(token.expires_at).getTime() > now.getTime();
}

/** Suppliers see published documents and their earlier versions; drafts and revoked documents stay hidden. */
export function isDocumentListed(status: string): boolean {
  return status === "published" || status === "superseded" || status === "revoked";
}

/** Only published documents and earlier versions can be opened; a revoked document never can. */
export function isDocumentOpenable(status: string): boolean {
  return status === "published" || status === "superseded";
}

/** The supplier may send additional information only when JERRY GROUP has asked for it. */
export function canSupplierReply(status: string): boolean {
  return status === "additional_info_required";
}

/** Private folder for files sent with a supplier reply. */
export function replyFolder(proposalId: string, clientMessageId: string): string {
  return `replies/${proposalId}/${clientMessageId}`;
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const verifyInputSchema = z.object({
  reference: z.string().max(40),
  contact: z.string().max(255),
  website: z.string().max(200).optional(),
});

export const tokenSchema = z.string().regex(TOKEN_PATTERN);
