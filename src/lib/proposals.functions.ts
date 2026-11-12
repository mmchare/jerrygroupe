import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  ALLOWED_FILE_TYPES,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_FILE_MB,
  attachmentFolder,
  checkAttachment,
  fileExtension,
  parseExtraFields,
  proposalPayloadSchema,
  validateExtraAnswers,
} from "./proposal-rules";

const BUCKET = "proposal-attachments";
const MAX_PER_IP_PER_HOUR = 5;
const MAX_PER_EMAIL_PER_DAY = 10;

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function readUploadLimits(admin: AdminClient) {
  const { data } = await admin
    .from("site_settings")
    .select("key, value_en")
    .in("key", ["upload_max_mb", "upload_max_files"]);
  const get = (key: string, fallback: number) => {
    const n = Number(data?.find((r) => r.key === key)?.value_en);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    maxMb: get("upload_max_mb", DEFAULT_MAX_FILE_MB),
    maxFiles: get("upload_max_files", DEFAULT_MAX_FILES),
  };
}

async function hashIp(): Promise<string | null> {
  const ip = getRequestIP({ xForwardedFor: true });
  if (!ip) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`jg:${ip}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ */
/* Step 3 — signed, single-use upload slot for one attachment          */
/* ------------------------------------------------------------------ */

const uploadRequestSchema = z.object({
  clientSubmissionId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  mimeType: z.string().max(150),
});

export type UploadSlotResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: "fileType" | "fileSize" | "fileEmpty" | "fileCount" | "uploadFailed" };

export const createAttachmentUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadRequestSchema.parse(input))
  .handler(async ({ data }): Promise<UploadSlotResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limits = await readUploadLimits(supabaseAdmin);

    const problem = checkAttachment(
      { name: data.fileName, size: data.size, type: data.mimeType },
      limits.maxMb,
    );
    if (problem) return { ok: false, error: problem };

    const folder = attachmentFolder(data.clientSubmissionId);

    // A submission that was already sent cannot receive new files.
    const { data: existing } = await supabaseAdmin
      .from("proposals")
      .select("id")
      .eq("client_submission_id", data.clientSubmissionId)
      .maybeSingle();
    if (existing) return { ok: false, error: "uploadFailed" };

    // Allow a few replacements beyond the visible limit (removed files stay in the folder).
    const { data: listed } = await supabaseAdmin.storage.from(BUCKET).list(folder, { limit: 100 });
    if ((listed?.length ?? 0) >= limits.maxFiles + 5) return { ok: false, error: "fileCount" };

    const path = `${folder}/${crypto.randomUUID()}.${fileExtension(data.fileName)}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) {
      console.error("[proposals] signed upload failed", error?.message);
      return { ok: false, error: "uploadFailed" };
    }
    return { ok: true, path: signed.path, token: signed.token };
  });

/* ------------------------------------------------------------------ */
/* Step 4 — submit the proposal                                        */
/* ------------------------------------------------------------------ */

export type SubmitResult =
  | { ok: true; reference: string; createdAt: string }
  | {
      ok: false;
      error: "invalid" | "rateLimited" | "attachmentsMissing" | "submitFailed";
      fields?: Record<string, string>;
    };

export const submitProposal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => proposalPayloadSchema.parse(input))
  .handler(async ({ data }): Promise<SubmitResult> => {
    // Honeypot filled: silently refuse.
    if (data.website) return { ok: false, error: "invalid" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Double submission (double click, network retry): return the original reference.
    const { data: already } = await supabaseAdmin
      .from("proposals")
      .select("reference, created_at")
      .eq("client_submission_id", data.clientSubmissionId)
      .maybeSingle();
    if (already) return { ok: true, reference: already.reference, createdAt: already.created_at };

    // Category and its configured specific fields.
    const { data: category } = await supabaseAdmin
      .from("proposal_categories")
      .select("id, extra_fields, is_active")
      .eq("id", data.categoryId)
      .maybeSingle();
    if (!category || !category.is_active) {
      return { ok: false, error: "invalid", fields: { categoryId: "required" } };
    }
    const extra = validateExtraAnswers(parseExtraFields(category.extra_fields), data.extraAnswers);
    if (Object.keys(extra.errors).length > 0) {
      return { ok: false, error: "invalid", fields: extra.errors };
    }

    // Anti-abuse limits.
    const ipHash = await hashIp();
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    if (ipHash) {
      const { count } = await supabaseAdmin
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("created_at", hourAgo);
      if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) return { ok: false, error: "rateLimited" };
    }
    const { count: emailCount } = await supabaseAdmin
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .ilike("email", data.email)
      .gte("created_at", dayAgo);
    if ((emailCount ?? 0) >= MAX_PER_EMAIL_PER_DAY) return { ok: false, error: "rateLimited" };

    // Verify every declared attachment really exists in this submission's private folder.
    const limits = await readUploadLimits(supabaseAdmin);
    const folder = attachmentFolder(data.clientSubmissionId);
    const attachments: { storage_path: string; original_name: string; mime_type: string; size_bytes: number }[] = [];
    if (data.attachments.length > 0) {
      if (data.attachments.length > limits.maxFiles) return { ok: false, error: "attachmentsMissing" };
      const { data: listed, error: listError } = await supabaseAdmin.storage
        .from(BUCKET)
        .list(folder, { limit: 100 });
      if (listError) return { ok: false, error: "submitFailed" };
      for (const a of data.attachments) {
        const fileName = a.path.startsWith(`${folder}/`) ? a.path.slice(folder.length + 1) : null;
        const object = fileName ? listed?.find((o) => o.name === fileName) : undefined;
        const meta = (object?.metadata ?? {}) as { size?: number; mimetype?: string };
        const size = Number(meta.size ?? 0);
        const mime = String(meta.mimetype ?? "").toLowerCase();
        const allowed = ALLOWED_FILE_TYPES[fileExtension(a.originalName)];
        if (!object || size <= 0 || !allowed || (mime && !allowed.includes(mime))) {
          return { ok: false, error: "attachmentsMissing" };
        }
        attachments.push({
          storage_path: a.path,
          original_name: a.originalName,
          mime_type: mime || allowed[0]!,
          size_bytes: size,
        });
      }
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("proposals")
      .insert({
        // The database trigger assigns the definitive reference.
        reference: "pending",
        client_submission_id: data.clientSubmissionId,
        proposer_type: data.proposerType,
        full_name: data.fullName,
        company_name: data.companyName ?? null,
        country_code: data.countryCode,
        city: data.city,
        email: data.email.toLowerCase(),
        whatsapp_e164: data.whatsapp,
        preferred_language: data.preferredLanguage,
        category_id: data.categoryId,
        title: data.title,
        description: data.description,
        origin_country_code: data.originCountryCode ?? null,
        quantity: data.quantity ?? null,
        unit: data.unit ?? null,
        asking_price: data.askingPrice ?? null,
        currency: data.currency ?? null,
        product_condition: data.productCondition ?? null,
        availability: data.availability ?? null,
        delivery_location: data.deliveryLocation ?? null,
        additional_info: data.additionalInfo ?? null,
        extra_answers: extra.clean,
        submission_language: data.submissionLanguage,
        declaration_accepted_at: new Date().toISOString(),
        ip_hash: ipHash,
        user_agent: (getRequestHeader("user-agent") ?? "").slice(0, 300) || null,
      })
      .select("id, reference, created_at")
      .single();

    if (insertError || !inserted) {
      // A concurrent duplicate may have won the race: return its reference.
      const { data: raced } = await supabaseAdmin
        .from("proposals")
        .select("reference, created_at")
        .eq("client_submission_id", data.clientSubmissionId)
        .maybeSingle();
      if (raced) return { ok: true, reference: raced.reference, createdAt: raced.created_at };
      console.error("[proposals] insert failed", insertError?.message);
      return { ok: false, error: "submitFailed" };
    }

    if (attachments.length > 0) {
      const { error: attachError } = await supabaseAdmin
        .from("proposal_attachments")
        .insert(attachments.map((a) => ({ ...a, proposal_id: inserted.id })));
      if (attachError) console.error("[proposals] attachment records failed", attachError.message);
    }

    return { ok: true, reference: inserted.reference, createdAt: inserted.created_at };
  });
