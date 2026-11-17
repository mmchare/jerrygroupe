import { useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FilePlus2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { AdminFileButtons } from "./AdminFileButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  createAdminDocumentUpload,
  publishAdminDocument,
  revokeAdminDocument,
  type AdminDocument,
} from "@/lib/admin.functions";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/tracking-rules";
import { formatDate, formatSize } from "@/components/tracking/format";
import { cn } from "@/lib/utils";

const documentStatusLabels = {
  draft: "Brouillon",
  published: "Publié",
  superseded: "Remplacé",
  revoked: "Révoqué",
};

export function AdminDocumentManager({ proposalId, documents }: { proposalId: string; documents: AdminDocument[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const createUpload = useServerFn(createAdminDocumentUpload);
  const publish = useServerFn(publishAdminDocument);
  const revoke = useServerFn(revokeAdminDocument);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState<string | undefined>();
  const [docType, setDocType] = useState<DocumentType>("contract");
  const [reference, setReference] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "proposal", proposalId] });
  }

  function prepareVersion(document: AdminDocument) {
    setGroupId(document.groupId);
    setDocType(document.type);
    setReference(document.reference);
    setTitleEn(document.titleEn);
    setTitleFr(document.titleFr);
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    document.getElementById("document-publication")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !reference.trim() || busy) return;
    setBusy(true);
    try {
      const slot = await createUpload({
        data: { proposalId, fileName: file.name, size: file.size, mimeType: file.type || "application/pdf" },
      });
      const { error: uploadError } = await supabase.storage
        .from("supplier-documents")
        .uploadToSignedUrl(slot.path, slot.token, file, { contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);
      await publish({
        data: {
          proposalId,
          groupId,
          docType,
          reference,
          titleEn,
          titleFr,
          issueDate,
          path: slot.path,
          fileName: file.name,
          size: file.size,
          mimeType: file.type || "application/pdf",
        },
      });
      await refresh();
      setFile(null);
      setGroupId(undefined);
      setReference("");
      setTitleEn("");
      setTitleFr("");
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Le document est publié dans l’espace du fournisseur.");
    } catch {
      toast.error("Le document n’a pas pu être publié. Vérifiez le PDF et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeDocument(document: AdminDocument) {
    if (!window.confirm(`Révoquer « ${document.reference} » ? Le fournisseur ne pourra plus l’ouvrir.`)) return;
    setRevoking(document.id);
    try {
      await revoke({ data: { documentId: document.id } });
      await refresh();
      toast.success("Le document a été révoqué.");
    } catch {
      toast.error("Le document n’a pas pu être révoqué.");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section id="document-publication" className="scroll-mt-6 border border-border bg-card p-6 shadow-card md:p-8" aria-labelledby="documents-admin-title">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Supplier Document Center</p>
          <h2 id="documents-admin-title" className="mt-2 text-2xl text-navy">Documents fournisseur</h2>
        </div>
        <p className="text-sm text-muted-foreground">PDF uniquement · 20 Mo maximum</p>
      </div>

      <form onSubmit={(event) => void submit(event)} className="mt-6 border border-navy/15 bg-secondary/40 p-5">
        <h3 className="font-semibold text-navy">{groupId ? "Publier une nouvelle version" : "Publier un nouveau document"}</h3>
        {groupId && (
          <button type="button" className="mt-1 text-xs text-navy underline underline-offset-4" onClick={() => setGroupId(undefined)}>
            Revenir à un nouveau document
          </button>
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={docType} onValueChange={(value) => setDocType(value as DocumentType)}>
              <SelectTrigger className="h-11 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{t.docs.types[type]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-reference">Référence</Label>
            <Input id="document-reference" required maxLength={60} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="JG-CTR-2026-001" className="h-11 bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-issue-date">Date d’émission</Label>
            <Input id="document-issue-date" required type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="h-11 bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document-file">Fichier PDF</Label>
            <Input ref={fileInput} id="document-file" required type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="h-11 bg-background py-2.5" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="document-title-fr">Titre français</Label>
            <Input id="document-title-fr" maxLength={200} value={titleFr} onChange={(event) => setTitleFr(event.target.value)} className="h-11 bg-background" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="document-title-en">Titre anglais</Label>
            <Input id="document-title-en" maxLength={200} value={titleEn} onChange={(event) => setTitleEn(event.target.value)} className="h-11 bg-background" />
          </div>
        </div>
        <Button type="submit" variant="gold" className="mt-5" disabled={busy || !file || !reference.trim()}>
          {busy ? <Loader2 className="animate-spin" /> : <FilePlus2 />} Publier le document
        </Button>
      </form>

      <div className="mt-8 space-y-3">
        {documents.length === 0 ? (
          <p className="border border-dashed border-input p-6 text-sm text-muted-foreground">Aucun document publié pour cette proposition.</p>
        ) : (
          documents.map((document) => (
            <article key={document.id} className="border border-border p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-navy">{document.reference}</h3>
                    <span className="text-xs text-muted-foreground">Version {document.version}</span>
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", document.status === "published" ? "border-gold bg-gold-soft text-navy" : "border-border bg-muted text-muted-foreground")}>
                      {documentStatusLabels[document.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-navy">{t.docs.types[document.type]} · {document.titleFr || document.titleEn || document.fileName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(document.issueDate, "fr")} · {formatSize(document.size)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminFileButtons proposalId={proposalId} kind="document" id={document.id} fileName={document.fileName} />
                  <Button type="button" size="sm" variant="outline-navy" onClick={() => prepareVersion(document)}><RotateCcw /> Nouvelle version</Button>
                  {document.status === "published" && (
                    <Button type="button" size="sm" variant="destructive" disabled={revoking === document.id} onClick={() => void revokeDocument(document)}>
                      {revoking === document.id && <Loader2 className="animate-spin" />} Révoquer
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
