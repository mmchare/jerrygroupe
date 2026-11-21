import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ADMIN_DOCUMENT_MAX_BYTES,
  ADMIN_DOCUMENT_MIME,
  adminDocumentProblem,
  adminDocumentSchema,
  adminDocumentUploadSchema,
  adminListSchema,
  adminMessageSchema,
  adminStatusSchema,
  filterAdminProposals,
  nextDocumentVersion,
} from "./admin-rules";
import {
  DOCUMENT_TYPES,
  PROPOSAL_STATUSES,
  SIGNED_URL_TTL_SECONDS,
  type DocumentStatus,
  type DocumentType,
  type ProposalStatus,
} from "./tracking-rules";

const ATTACHMENTS_BUCKET = "proposal-attachments";
const DOCUMENTS_BUCKET = "supplier-documents";

type AuthContext = { supabase: SupabaseClient<Database>; userId: string };
type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["context.supabase"];

async function isAdmin(context: AuthContext): Promise<boolean> {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) {
    console.error("[admin] role verification failed", error.message);
    return false;
  }
  return data === true;
}

async function requireAdmin(context: AuthContext): Promise<void> {
  if (!(await isAdmin(context))) throw new Error("Forbidden");
}

function privateResponse() {
  setResponseHeader("Cache-Control", "no-store");
  setResponseHeader("Referrer-Policy", "no-referrer");
}

function publicStorageUrl(url: string): string {
  const serverBase = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  const publicBase = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  if (serverBase && publicBase && serverBase !== publicBase && url.startsWith(serverBase)) {
    return publicBase + url.slice(serverBase.length);
  }
  return url;
}

export const getAdminSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    privateResponse();
    const { data: userData } = await context.supabase.auth.getUser();
    return {
      email: userData.user?.email ?? "",
      isAdmin: await isAdmin(context),
    };
  });

export type AdminProposalSummary = {
  id: string;
  reference: string;
  full_name: string;
  company_name: string | null;
  email: string;
  whatsapp_e164: string;
  country_code: string;
  city: string;
  title: string;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
  category: { en: string; fr: string };
};

export const getAdminProposals = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminListSchema.parse(input ?? {}))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireAdmin(context);
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await db
      .from("proposals")
      .select(
        "id, reference, full_name, company_name, email, whatsapp_e164, country_code, city, title, status, created_at, updated_at, proposal_categories(name_en, name_fr)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("Unable to load proposals");

    const summaries: AdminProposalSummary[] = (rows ?? []).map((row) => {
      const category = Array.isArray(row.proposal_categories)
        ? row.proposal_categories[0]
        : row.proposal_categories;
      return {
        id: row.id,
        reference: row.reference,
        full_name: row.full_name,
        company_name: row.company_name,
        email: row.email,
        whatsapp_e164: row.whatsapp_e164,
        country_code: row.country_code,
        city: row.city,
        title: row.title,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        category: { en: category?.name_en ?? "", fr: category?.name_fr ?? "" },
      };
    });
    const counts = Object.fromEntries(
      PROPOSAL_STATUSES.map((status) => [status, summaries.filter((row) => row.status === status).length]),
    ) as Record<ProposalStatus, number>;
    const statusRows = data.status ? summaries.filter((row) => row.status === data.status) : summaries;
    return {
      proposals: filterAdminProposals(statusRows, data.search),
      counts,
      total: summaries.length,
    };
  });

export type AdminAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  at: string;
  messageId: string | null;
};
export type AdminMessage = {
  id: string;
  direction: "to_supplier" | "from_supplier";
  body: string;
  at: string;
};
export type AdminHistory = {
  id: string;
  status: ProposalStatus;
  internalNote: string | null;
  supplierMessage: string | null;
  changedBy: string | null;
  at: string;
};
export type AdminDocument = {
  id: string;
  groupId: string;
  type: DocumentType;
  reference: string;
  titleEn: string;
  titleFr: string;
  version: number;
  status: DocumentStatus;
  issueDate: string;
  publishedAt: string | null;
  revokedAt: string | null;
  fileName: string;
  mimeType: string;
  size: number;
};
export type AdminProposalDetail = {
  id: string;
  reference: string;
  proposerType: string;
  fullName: string;
  companyName: string | null;
  countryCode: string;
  city: string;
  email: string;
  whatsapp: string;
  preferredLanguage: string;
  title: string;
  description: string;
  originCountryCode: string | null;
  quantity: number | null;
  unit: string | null;
  askingPrice: number | null;
  currency: string | null;
  productCondition: string | null;
  availability: string | null;
  deliveryLocation: string | null;
  additionalInfo: string | null;
  extraAnswers: Record<string, unknown>;
  submissionLanguage: string;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
  category: { en: string; fr: string };
  attachments: AdminAttachment[];
  messages: AdminMessage[];
  history: AdminHistory[];
  documents: AdminDocument[];
};

export const getAdminProposal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ proposalId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AdminProposalDetail> => {
    privateResponse();
    await requireAdmin(context);
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    const [proposalRes, attachmentsRes, messagesRes, historyRes, documentsRes] = await Promise.all([
      db
        .from("proposals")
        .select(
          "id, reference, proposer_type, full_name, company_name, country_code, city, email, whatsapp_e164, preferred_language, title, description, origin_country_code, quantity, unit, asking_price, currency, product_condition, availability, delivery_location, additional_info, extra_answers, submission_language, status, created_at, updated_at, proposal_categories(name_en, name_fr)",
        )
        .eq("id", data.proposalId)
        .single(),
      db
        .from("proposal_attachments")
        .select("id, original_name, mime_type, size_bytes, created_at, message_id")
        .eq("proposal_id", data.proposalId)
        .order("created_at", { ascending: true }),
      db
        .from("proposal_messages")
        .select("id, direction, body, created_at")
        .eq("proposal_id", data.proposalId)
        .order("created_at", { ascending: true }),
      db
        .from("proposal_status_history")
        .select("id, status, internal_note, supplier_message, changed_by, created_at")
        .eq("proposal_id", data.proposalId)
        .order("created_at", { ascending: true }),
      db
        .from("supplier_documents")
        .select(
          "id, document_group_id, doc_type, reference, title_en, title_fr, version, status, issue_date, published_at, revoked_at, file_name, mime_type, size_bytes",
        )
        .eq("proposal_id", data.proposalId)
        .order("created_at", { ascending: false }),
    ]);
    const p = proposalRes.data;
    if (proposalRes.error || !p) throw new Error("Proposal not found");
    const category = Array.isArray(p.proposal_categories) ? p.proposal_categories[0] : p.proposal_categories;
    return {
      id: p.id,
      reference: p.reference,
      proposerType: p.proposer_type,
      fullName: p.full_name,
      companyName: p.company_name,
      countryCode: p.country_code,
      city: p.city,
      email: p.email,
      whatsapp: p.whatsapp_e164,
      preferredLanguage: p.preferred_language,
      title: p.title,
      description: p.description,
      originCountryCode: p.origin_country_code,
      quantity: p.quantity === null ? null : Number(p.quantity),
      unit: p.unit,
      askingPrice: p.asking_price === null ? null : Number(p.asking_price),
      currency: p.currency,
      productCondition: p.product_condition,
      availability: p.availability,
      deliveryLocation: p.delivery_location,
      additionalInfo: p.additional_info,
      extraAnswers: (p.extra_answers ?? {}) as Record<string, unknown>,
      submissionLanguage: p.submission_language,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      category: { en: category?.name_en ?? "", fr: category?.name_fr ?? "" },
      attachments: (attachmentsRes.data ?? []).map((file) => ({
        id: file.id,
        name: file.original_name,
        mimeType: file.mime_type,
        size: Number(file.size_bytes),
        at: file.created_at,
        messageId: file.message_id,
      })),
      messages: (messagesRes.data ?? []).map((message) => ({
        id: message.id,
        direction: message.direction === "from_supplier" ? "from_supplier" : "to_supplier",
        body: message.body,
        at: message.created_at,
      })),
      history: (historyRes.data ?? []).map((item) => ({
        id: item.id,
        status: item.status,
        internalNote: item.internal_note,
        supplierMessage: item.supplier_message,
        changedBy: item.changed_by,
        at: item.created_at,
      })),
      documents: (documentsRes.data ?? []).map((document) => ({
        id: document.id,
        groupId: document.document_group_id,
        type: document.doc_type,
        reference: document.reference,
        titleEn: document.title_en,
        titleFr: document.title_fr,
        version: document.version,
        status: document.status as DocumentStatus,
        issueDate: document.issue_date,
        publishedAt: document.published_at,
        revokedAt: document.revoked_at,
        fileName: document.file_name,
        mimeType: document.mime_type,
        size: Number(document.size_bytes),
      })),
    };
  });

export const updateAdminProposalStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminStatusSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireAdmin(context);
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    const { data: current } = await db
      .from("proposals")
      .select("status")
      .eq("id", data.proposalId)
      .single();
    if (!current) throw new Error("Proposal not found");
    if (current.status === data.status) throw new Error("Status unchanged");

    const { error } = await db
      .from("proposals")
      .update({ status: data.status })
      .eq("id", data.proposalId);
    if (error) throw new Error("Unable to update status");

    const { data: history } = await db
      .from("proposal_status_history")
      .select("id")
      .eq("proposal_id", data.proposalId)
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (history) {
      const { error: historyError } = await db
        .from("proposal_status_history")
        .update({
          changed_by: context.userId,
          internal_note: data.internalNote || null,
          supplier_message: data.supplierMessage || null,
        })
        .eq("id", history.id);
      if (historyError) console.error("[admin] history metadata failed", historyError.message);
    }
    return { ok: true as const };
  });

export const sendAdminMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminMessageSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireAdmin(context);
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("proposal_messages").insert({
      proposal_id: data.proposalId,
      direction: "to_supplier",
      body: data.body,
      author_id: context.userId,
    });
    if (error) throw new Error("Unable to send message");
    return { ok: true as const };
  });

export const createAdminDocumentUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminDocumentUploadSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireAdmin(context);
    const problem = adminDocumentProblem({ name: data.fileName, size: data.size, type: data.mimeType });
    if (problem) throw new Error(problem);
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    const { data: proposal } = await db.from("proposals").select("id").eq("id", data.proposalId).single();
    if (!proposal) throw new Error("Proposal not found");
    const path = `admin/${data.proposalId}/${crypto.randomUUID()}.pdf`;
    const { data: signed, error } = await db.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Unable to create document upload");
    return { path: signed.path, token: signed.token };
  });

export const publishAdminDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => adminDocumentSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireAdmin(context);
    if (adminDocumentProblem({ name: data.fileName, size: data.size, type: data.mimeType })) {
      throw new Error("Invalid document");
    }
    const folder = `admin/${data.proposalId}`;
    if (!data.path.startsWith(`${folder}/`) || data.path.slice(folder.length + 1).includes("/")) {
      throw new Error("Invalid document path");
    }
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    const name = data.path.slice(folder.length + 1);
    const { data: listed, error: listError } = await db.storage.from(DOCUMENTS_BUCKET).list(folder, { limit: 1000 });
    const object = listed?.find((entry) => entry.name === name);
    const metadata = (object?.metadata ?? {}) as { size?: number; mimetype?: string };
    const storedSize = Number(metadata.size ?? 0);
    const storedMime = String(metadata.mimetype ?? "").toLowerCase();
    if (
      listError ||
      !object ||
      storedSize <= 0 ||
      storedSize > ADMIN_DOCUMENT_MAX_BYTES ||
      (storedMime && storedMime !== ADMIN_DOCUMENT_MIME)
    ) {
      throw new Error("Uploaded document could not be verified");
    }

    let version = 1;
    if (data.groupId) {
      const { data: previous, error: previousError } = await db
        .from("supplier_documents")
        .select("version")
        .eq("proposal_id", data.proposalId)
        .eq("document_group_id", data.groupId);
      if (previousError || !previous || previous.length === 0) throw new Error("Document group not found");
      version = nextDocumentVersion(previous.map((document) => document.version));
    }

    const { data: inserted, error } = await db
      .from("supplier_documents")
      .insert({
        proposal_id: data.proposalId,
        ...(data.groupId ? { document_group_id: data.groupId } : {}),
        version,
        doc_type: data.docType,
        reference: data.reference,
        title_en: data.titleEn,
        title_fr: data.titleFr,
        status: "published",
        issue_date: data.issueDate,
        storage_path: data.path,
        file_name: data.fileName,
        mime_type: storedMime || ADMIN_DOCUMENT_MIME,
        size_bytes: storedSize,
        created_by: context.userId,
      })
      .select("id, version")
      .single();
    if (error || !inserted) {
      await db.storage.from(DOCUMENTS_BUCKET).remove([data.path]);
      console.error("[admin] document publication failed", error?.message);
      throw new Error("Unable to publish document");
    }
    return { ok: true as const, id: inserted.id, version: inserted.version };
  });

export const revokeAdminDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireAdmin(context);
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    const { data: revoked, error } = await db
      .from("supplier_documents")
      .update({ status: "revoked" })
      .eq("id", data.documentId)
      .eq("status", "published")
      .select("id")
      .maybeSingle();
    if (error || !revoked) throw new Error("Unable to revoke document");
    return { ok: true as const };
  });

export const getAdminFileLink = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        proposalId: z.string().uuid(),
        kind: z.enum(["document", "attachment"]),
        id: z.string().uuid(),
        download: z.boolean(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    privateResponse();
    await requireAdmin(context);
    const { context.supabase: db } = await import("@/integrations/supabase/client.server");
    let bucket: string;
    let path: string;
    let fileName: string;
    if (data.kind === "document") {
      const { data: document } = await db
        .from("supplier_documents")
        .select("storage_path, file_name")
        .eq("id", data.id)
        .eq("proposal_id", data.proposalId)
        .single();
      if (!document) throw new Error("File not found");
      bucket = DOCUMENTS_BUCKET;
      path = document.storage_path;
      fileName = document.file_name;
    } else {
      const { data: attachment } = await db
        .from("proposal_attachments")
        .select("storage_path, original_name")
        .eq("id", data.id)
        .eq("proposal_id", data.proposalId)
        .single();
      if (!attachment) throw new Error("File not found");
      bucket = ATTACHMENTS_BUCKET;
      path = attachment.storage_path;
      fileName = attachment.original_name;
    }
    const { data: signed, error } = await db.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, data.download ? { download: fileName } : undefined);
    if (error || !signed) throw new Error("Unable to open file");
    return { url: publicStorageUrl(signed.signedUrl) };
  });

export const ADMIN_DOCUMENT_TYPES = DOCUMENT_TYPES;
