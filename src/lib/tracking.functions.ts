import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { ALLOWED_FILE_TYPES, DEFAULT_MAX_FILE_MB, checkAttachment, fileExtension } from "./proposal-rules";
import {
  LINK_TTL_MS,
  MAX_REPLIES_PER_DAY,
  MAX_REPLY_FILES,
  REFERENCE_PATTERN,
  SESSION_TTL_MS,
  SIGNED_URL_TTL_SECONDS,
  canSupplierReply,
  contactMatches,
  generateToken,
  isDocumentListed,
  isDocumentOpenable,
  isTokenUsable,
  isVerificationLocked,
  normalizeReference,
  parseContactProof,
  replyFolder,
  sha256Hex,
  tokenSchema,
  verifyInputSchema,
  type DocumentStatus,
  type DocumentType,
  type ProposalStatus,
} from "./tracking-rules";

const ATTACHMENTS_BUCKET = "proposal-attachments";
const DOCUMENTS_BUCKET = "supplier-documents";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<AdminClient> {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function hashIp(): Promise<string | null> {
  const ip = getRequestIP({ xForwardedFor: true });
  return ip ? sha256Hex(`jg:${ip}`) : null;
}

function privateResponse() {
  // Supplier data must never be stored by shared caches or leak through referrers.
  setResponseHeader("Cache-Control", "no-store");
  setResponseHeader("Referrer-Policy", "no-referrer");
}

/** Issues a new access token for a proposal and returns the raw value (only its hash is stored). */
export async function issueAccessToken(
  db: AdminClient,
  proposalId: string,
  purpose: "link" | "session",
): Promise<{ token: string; expiresAt: string } | null> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + (purpose === "link" ? LINK_TTL_MS : SESSION_TTL_MS)).toISOString();
  const { error } = await db.from("supplier_access_tokens").insert({
    proposal_id: proposalId,
    token_hash: await sha256Hex(token),
    purpose,
    expires_at: expiresAt,
  });
  if (error) {
    console.error("[tracking] token insert failed", error.message);
    return null;
  }
  return { token, expiresAt };
}

type Access =
  | { ok: true; tokenId: string; proposalId: string; purpose: "link" | "session"; expiresAt: string }
  | { ok: false; reason: "invalid" | "expired" };

async function resolveAccess(db: AdminClient, rawToken: string): Promise<Access> {
  const parsed = tokenSchema.safeParse(rawToken);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { data } = await db
    .from("supplier_access_tokens")
    .select("id, proposal_id, purpose, expires_at, revoked_at")
    .eq("token_hash", await sha256Hex(parsed.data))
    .maybeSingle();
  if (!data) return { ok: false, reason: "invalid" };
  if (!isTokenUsable(data)) return { ok: false, reason: "expired" };
  await db.from("supplier_access_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return {
    ok: true,
    tokenId: data.id,
    proposalId: data.proposal_id,
    purpose: data.purpose === "link" ? "link" : "session",
    expiresAt: data.expires_at,
  };
}

/** Rewrites a storage URL to the public backend address the browser can reach. */
function publicStorageUrl(url: string): string {
  const serverBase = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  const publicBase = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  if (serverBase && publicBase && serverBase !== publicBase && url.startsWith(serverBase)) {
    return publicBase + url.slice(serverBase.length);
  }
  return url;
}

/* ------------------------------------------------------------------ */
/* Verification: reference + email or WhatsApp used at submission      */
/* ------------------------------------------------------------------ */

export type VerifyResult = { ok: true; token: string } | { ok: false; error: "notFound" | "locked" | "invalid" };

export const verifyTracking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifyInputSchema.parse(input))
  .handler(async ({ data }): Promise<VerifyResult> => {
    privateResponse();
    if (data.website) return { ok: false, error: "notFound" };
    const reference = normalizeReference(data.reference);
    const proof = parseContactProof(data.contact);
    if (!REFERENCE_PATTERN.test(reference) || !proof) return { ok: false, error: "invalid" };

    const db = await admin();
    const ipHash = await hashIp();
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();

    const [ipFails, refFails] = await Promise.all([
      ipHash
        ? db
            .from("tracking_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .eq("success", false)
            .gte("created_at", hourAgo)
        : Promise.resolve({ count: 0 }),
      db
        .from("tracking_attempts")
        .select("id", { count: "exact", head: true })
        .eq("reference", reference)
        .eq("success", false)
        .gte("created_at", hourAgo),
    ]);
    if (isVerificationLocked(ipFails.count ?? 0, refFails.count ?? 0)) return { ok: false, error: "locked" };

    const { data: proposal } = await db
      .from("proposals")
      .select("id, email, whatsapp_e164")
      .eq("reference", reference)
      .maybeSingle();
    const matched = !!proposal && contactMatches(proof, proposal);

    await db.from("tracking_attempts").insert({ ip_hash: ipHash, reference, success: matched });
    // Same answer whether the reference exists or the contact is wrong: no dossier discovery.
    if (!matched || !proposal) return { ok: false, error: "notFound" };

    const issued = await issueAccessToken(db, proposal.id, "session");
    if (!issued) return { ok: false, error: "invalid" };
    return { ok: true, token: issued.token };
  });

/* ------------------------------------------------------------------ */
/* Portal data                                                          */
/* ------------------------------------------------------------------ */

export type PortalFile = { id: string; name: string; size: number; at: string };
export type PortalMessage = {
  id: string;
  direction: "to_supplier" | "from_supplier";
  body: string;
  at: string;
  files: PortalFile[];
};
export type PortalDocument = {
  id: string;
  groupId: string;
  type: DocumentType;
  reference: string;
  title: { en: string; fr: string };
  version: number;
  status: DocumentStatus;
  issueDate: string;
  publishedAt: string | null;
  revokedAt: string | null;
  fileName: string;
  mimeType: string;
  size: number;
};
export type PortalData = {
  reference: string;
  createdAt: string;
  lastUpdate: string;
  title: string;
  category: { en: string; fr: string };
  status: ProposalStatus;
  access: { purpose: "link" | "session"; expiresAt: string };
  canReply: boolean;
  history: { status: ProposalStatus; at: string }[];
  messages: PortalMessage[];
  submittedFiles: PortalFile[];
  documents: PortalDocument[];
};
export type PortalResult = { ok: true; data: PortalData } | { ok: false; reason: "invalid" | "expired" };

export const getSupplierPortal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().max(100) }).parse(input))
  .handler(async ({ data }): Promise<PortalResult> => {
    privateResponse();
    const db = await admin();
    const access = await resolveAccess(db, data.token);
    if (!access.ok) return access;

    const [proposalRes, historyRes, messagesRes, filesRes, docsRes] = await Promise.all([
      db
        .from("proposals")
        .select("reference, created_at, updated_at, title, status, proposal_categories(name_en, name_fr)")
        .eq("id", access.proposalId)
        .single(),
      // internal_note is never selected: it must not reach the supplier.
      db
        .from("proposal_status_history")
        .select("id, status, supplier_message, created_at")
        .eq("proposal_id", access.proposalId)
        .order("created_at", { ascending: true }),
      db
        .from("proposal_messages")
        .select("id, direction, body, created_at")
        .eq("proposal_id", access.proposalId)
        .order("created_at", { ascending: true }),
      db
        .from("proposal_attachments")
        .select("id, original_name, size_bytes, created_at, message_id")
        .eq("proposal_id", access.proposalId)
        .order("created_at", { ascending: true }),
      db
        .from("supplier_documents")
        .select(
          "id, document_group_id, doc_type, reference, title_en, title_fr, version, status, issue_date, published_at, revoked_at, file_name, mime_type, size_bytes",
        )
        .eq("proposal_id", access.proposalId)
        .in("status", ["published", "superseded", "revoked"])
        .order("published_at", { ascending: false }),
    ]);

    const p = proposalRes.data;
    if (!p) return { ok: false, reason: "invalid" };
    const cat = (Array.isArray(p.proposal_categories) ? p.proposal_categories[0] : p.proposal_categories) as
      | { name_en: string; name_fr: string }
      | null;

    const files = (filesRes.data ?? []).map((f) => ({
      id: f.id,
      name: f.original_name,
      size: Number(f.size_bytes),
      at: f.created_at,
      messageId: f.message_id,
    }));
    const history = historyRes.data ?? [];
    const messages: PortalMessage[] = [
      ...history
        .filter((h) => h.supplier_message && h.supplier_message.trim())
        .map((h) => ({
          id: `h-${h.id}`,
          direction: "to_supplier" as const,
          body: h.supplier_message!,
          at: h.created_at,
          files: [],
        })),
      ...(messagesRes.data ?? []).map((m) => ({
        id: m.id,
        direction: m.direction === "from_supplier" ? ("from_supplier" as const) : ("to_supplier" as const),
        body: m.body,
        at: m.created_at,
        files: files.filter((f) => f.messageId === m.id).map(({ messageId: _m, ...f }) => f),
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const documents: PortalDocument[] = (docsRes.data ?? [])
      .filter((d) => isDocumentListed(d.status))
      .map((d) => ({
        id: d.id,
        groupId: d.document_group_id,
        type: d.doc_type,
        reference: d.reference,
        title: { en: d.title_en, fr: d.title_fr },
        version: d.version,
        status: d.status as DocumentStatus,
        issueDate: d.issue_date,
        publishedAt: d.published_at,
        revokedAt: d.revoked_at,
        fileName: d.file_name,
        mimeType: d.mime_type,
        size: Number(d.size_bytes),
      }));

    const dates = [p.updated_at, ...history.map((h) => h.created_at), ...messages.map((m) => m.at), ...documents.map((d) => d.publishedAt ?? "")];
    const lastUpdate = dates.filter(Boolean).sort().at(-1) ?? p.updated_at;

    return {
      ok: true,
      data: {
        reference: p.reference,
        createdAt: p.created_at,
        lastUpdate,
        title: p.title,
        category: { en: cat?.name_en ?? "", fr: cat?.name_fr ?? "" },
        status: p.status,
        access: { purpose: access.purpose, expiresAt: access.expiresAt },
        canReply: canSupplierReply(p.status),
        history: history.map((h) => ({ status: h.status, at: h.created_at })),
        messages,
        submittedFiles: files.filter((f) => !f.messageId).map(({ messageId: _m, ...f }) => f),
        documents,
      },
    };
  });

/* ------------------------------------------------------------------ */
/* Temporary signed links (documents and the supplier's own files)      */
/* ------------------------------------------------------------------ */

export type LinkResult = { ok: true; url: string } | { ok: false; error: "denied" | "expired" | "failed" };

export const getDocumentLink = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().max(100),
        kind: z.enum(["document", "attachment"]),
        id: z.string().uuid(),
        download: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LinkResult> => {
    privateResponse();
    const db = await admin();
    const access = await resolveAccess(db, data.token);
    if (!access.ok) return { ok: false, error: access.reason === "expired" ? "expired" : "denied" };

    let bucket: string;
    let path: string;
    let fileName: string;
    if (data.kind === "document") {
      const { data: doc } = await db
        .from("supplier_documents")
        .select("storage_path, file_name, status")
        .eq("id", data.id)
        .eq("proposal_id", access.proposalId)
        .maybeSingle();
      if (!doc || !isDocumentOpenable(doc.status)) return { ok: false, error: "denied" };
      bucket = DOCUMENTS_BUCKET;
      path = doc.storage_path;
      fileName = doc.file_name;
    } else {
      const { data: file } = await db
        .from("proposal_attachments")
        .select("storage_path, original_name")
        .eq("id", data.id)
        .eq("proposal_id", access.proposalId)
        .maybeSingle();
      if (!file) return { ok: false, error: "denied" };
      bucket = ATTACHMENTS_BUCKET;
      path = file.storage_path;
      fileName = file.original_name;
    }

    const { data: signed, error } = await db.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, data.download ? { download: fileName } : undefined);
    if (error || !signed) {
      console.error("[tracking] signed url failed", error?.message);
      return { ok: false, error: "failed" };
    }
    return { ok: true, url: publicStorageUrl(signed.signedUrl) };
  });

/* ------------------------------------------------------------------ */
/* Additional information from the supplier                            */
/* ------------------------------------------------------------------ */

export type ReplyUploadResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: "fileType" | "fileSize" | "fileEmpty" | "fileCount" | "uploadFailed" | "replyClosed" | "expired" };

export const createReplyUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().max(100),
        clientMessageId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200),
        size: z.number().int().positive(),
        mimeType: z.string().max(150),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ReplyUploadResult> => {
    privateResponse();
    const db = await admin();
    const access = await resolveAccess(db, data.token);
    if (!access.ok) return { ok: false, error: "expired" };

    const { data: proposal } = await db.from("proposals").select("status").eq("id", access.proposalId).single();
    if (!proposal || !canSupplierReply(proposal.status)) return { ok: false, error: "replyClosed" };

    const problem = checkAttachment({ name: data.fileName, size: data.size, type: data.mimeType }, DEFAULT_MAX_FILE_MB);
    if (problem) return { ok: false, error: problem };

    const { data: sent } = await db
      .from("proposal_messages")
      .select("id")
      .eq("client_message_id", data.clientMessageId)
      .maybeSingle();
    if (sent) return { ok: false, error: "uploadFailed" };

    const folder = replyFolder(access.proposalId, data.clientMessageId);
    const { data: listed } = await db.storage.from(ATTACHMENTS_BUCKET).list(folder, { limit: 100 });
    if ((listed?.length ?? 0) >= MAX_REPLY_FILES + 5) return { ok: false, error: "fileCount" };

    const path = `${folder}/${crypto.randomUUID()}.${fileExtension(data.fileName)}`;
    const { data: signed, error } = await db.storage.from(ATTACHMENTS_BUCKET).createSignedUploadUrl(path);
    if (error || !signed) {
      console.error("[tracking] reply upload slot failed", error?.message);
      return { ok: false, error: "uploadFailed" };
    }
    return { ok: true, path: signed.path, token: signed.token };
  });

export type ReplyResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "replyClosed" | "rateLimited" | "attachmentsMissing" | "expired" | "submitFailed" };

export const submitSupplierReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().max(100),
        clientMessageId: z.string().uuid(),
        message: z.string().trim().min(2).max(5000),
        attachments: z
          .array(z.object({ path: z.string().max(300), originalName: z.string().trim().min(1).max(200) }))
          .max(MAX_REPLY_FILES),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ReplyResult> => {
    privateResponse();
    const db = await admin();
    const access = await resolveAccess(db, data.token);
    if (!access.ok) return { ok: false, error: "expired" };

    const { data: already } = await db
      .from("proposal_messages")
      .select("id, proposal_id")
      .eq("client_message_id", data.clientMessageId)
      .maybeSingle();
    if (already) return already.proposal_id === access.proposalId ? { ok: true } : { ok: false, error: "invalid" };

    const { data: proposal } = await db.from("proposals").select("status").eq("id", access.proposalId).single();
    if (!proposal || !canSupplierReply(proposal.status)) return { ok: false, error: "replyClosed" };

    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db
      .from("proposal_messages")
      .select("id", { count: "exact", head: true })
      .eq("proposal_id", access.proposalId)
      .eq("direction", "from_supplier")
      .gte("created_at", dayAgo);
    if ((count ?? 0) >= MAX_REPLIES_PER_DAY) return { ok: false, error: "rateLimited" };

    const folder = replyFolder(access.proposalId, data.clientMessageId);
    const rows: { storage_path: string; original_name: string; mime_type: string; size_bytes: number }[] = [];
    if (data.attachments.length > 0) {
      const { data: listed, error } = await db.storage.from(ATTACHMENTS_BUCKET).list(folder, { limit: 100 });
      if (error) return { ok: false, error: "submitFailed" };
      for (const a of data.attachments) {
        const name = a.path.startsWith(`${folder}/`) ? a.path.slice(folder.length + 1) : null;
        const object = name ? listed?.find((o) => o.name === name) : undefined;
        const meta = (object?.metadata ?? {}) as { size?: number; mimetype?: string };
        const size = Number(meta.size ?? 0);
        const mime = String(meta.mimetype ?? "").toLowerCase();
        const allowed = ALLOWED_FILE_TYPES[fileExtension(a.originalName)];
        if (!object || size <= 0 || !allowed || (mime && !allowed.includes(mime))) {
          return { ok: false, error: "attachmentsMissing" };
        }
        rows.push({ storage_path: a.path, original_name: a.originalName, mime_type: mime || allowed[0]!, size_bytes: size });
      }
    }

    const { data: inserted, error: insertError } = await db
      .from("proposal_messages")
      .insert({
        proposal_id: access.proposalId,
        direction: "from_supplier",
        body: data.message,
        client_message_id: data.clientMessageId,
        ip_hash: await hashIp(),
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      console.error("[tracking] reply insert failed", insertError?.message);
      return { ok: false, error: "submitFailed" };
    }
    if (rows.length > 0) {
      const { error } = await db
        .from("proposal_attachments")
        .insert(rows.map((r) => ({ ...r, proposal_id: access.proposalId, message_id: inserted.id })));
      if (error) console.error("[tracking] reply attachments failed", error.message);
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Close a verified session                                             */
/* ------------------------------------------------------------------ */

export const endSupplierSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().max(100) }).parse(input))
  .handler(async ({ data }) => {
    privateResponse();
    const db = await admin();
    const access = await resolveAccess(db, data.token);
    // The individual link stays valid; only a verified session is closed.
    if (access.ok && access.purpose === "session") {
      await db.from("supplier_access_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", access.tokenId);
    }
    return { ok: true };
  });
