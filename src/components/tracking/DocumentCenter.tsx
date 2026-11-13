import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Download, Eye, FileText, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { format, type Lang } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import type { PortalDocument } from "@/lib/tracking.functions";
import { isDocumentOpenable } from "@/lib/tracking-rules";
import { cn } from "@/lib/utils";
import { DocumentViewer, type ViewerState } from "./DocumentViewer";
import { formatDate } from "./format";
import { useFileLink } from "./useFileLink";

type Group = { latest: PortalDocument; older: PortalDocument[] };

function groupDocuments(docs: PortalDocument[]): Group[] {
  const byGroup = new Map<string, PortalDocument[]>();
  for (const d of docs) byGroup.set(d.groupId, [...(byGroup.get(d.groupId) ?? []), d]);
  return [...byGroup.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => b.version - a.version);
      return { latest: sorted[0]!, older: sorted.slice(1) };
    })
    .sort((a, b) => (b.latest.publishedAt ?? "").localeCompare(a.latest.publishedAt ?? ""));
}

function docTitle(d: PortalDocument, lang: Lang, fallback: string) {
  return (lang === "fr" ? d.title.fr || d.title.en : d.title.en || d.title.fr) || fallback;
}

export function DocumentCenter({ token, documents }: { token: string; documents: PortalDocument[] }) {
  const { t, lang } = useI18n();
  const { fetchLink, download, busy } = useFileLink(token);
  const [viewer, setViewer] = useState<ViewerState>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupDocuments(documents), [documents]);

  async function view(d: PortalDocument) {
    const url = await fetchLink("document", d.id, false);
    if (url) {
      setViewer({
        url,
        title: `${t.docs.types[d.type]} · ${d.reference}`,
        mimeType: d.mimeType,
        onDownload: () => void download("document", d.id),
      });
    }
  }

  const statusTone = (s: PortalDocument["status"]) =>
    s === "published"
      ? "border-gold/60 bg-gold-soft text-navy"
      : s === "revoked"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground";

  const actions = (d: PortalDocument) =>
    isDocumentOpenable(d.status) ? (
      <div className="flex gap-2">
        <Button size="sm" variant="outline-navy" onClick={() => void view(d)} disabled={!!busy} aria-label={`${t.portal.view} ${d.reference} v${d.version}`}>
          {busy === `${d.id}:v` ? <Loader2 className="animate-spin" /> : <Eye />} {t.portal.view}
        </Button>
        <Button size="sm" variant="gold" onClick={() => void download("document", d.id)} disabled={!!busy} aria-label={`${t.portal.download} ${d.reference} v${d.version}`}>
          {busy === `${d.id}:d` ? <Loader2 className="animate-spin" /> : <Download />} {t.portal.download}
        </Button>
      </div>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );

  const row = (d: PortalDocument, isOlder = false) => (
    <div
      key={d.id}
      className={cn(
        "grid gap-3 px-5 py-4 md:grid-cols-[1.6fr_1.2fr_0.9fr_0.9fr_0.6fr_1fr_auto] md:items-center md:gap-4",
        isOlder && "bg-muted/40",
      )}
      data-testid="document-row"
    >
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-navy">{t.docs.types[d.type]}</p>
          <p className="truncate text-xs text-muted-foreground">{docTitle(d, lang, d.fileName)}</p>
        </div>
      </div>
      <Cell label={t.docs.colReference}><span className="font-mono text-xs text-navy">{d.reference}</span></Cell>
      <Cell label={t.docs.colIssued}>{formatDate(d.issueDate, lang)}</Cell>
      <Cell label={t.docs.colPublished}>{d.publishedAt ? formatDate(d.publishedAt, lang) : "—"}</Cell>
      <Cell label={t.docs.colVersion}>{format(t.docs.version, { n: d.version })}</Cell>
      <Cell label={t.docs.colStatus}>
        <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", statusTone(d.status))}>
          {t.docs.statuses[d.status]}
        </span>
      </Cell>
      <div>{actions(d)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl text-navy md:text-3xl">{t.docs.title}</h2>
          <p className="mt-1 text-muted-foreground">{t.docs.lead}</p>
        </div>
        <p className="flex max-w-sm items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-gold" aria-hidden /> {t.docs.secureNote}
        </p>
      </header>

      {groups.length === 0 ? (
        <div className="border border-dashed border-input bg-card p-10 text-center" data-testid="documents-empty">
          <FileText className="mx-auto size-8 text-gold" aria-hidden />
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">{t.docs.empty}</p>
        </div>
      ) : (
        <div className="border border-border bg-card shadow-card">
          <div className="hidden grid-cols-[1.6fr_1.2fr_0.9fr_0.9fr_0.6fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>{t.docs.colType}</span>
            <span>{t.docs.colReference}</span>
            <span>{t.docs.colIssued}</span>
            <span>{t.docs.colPublished}</span>
            <span>{t.docs.colVersion}</span>
            <span>{t.docs.colStatus}</span>
            <span className="w-[13.5rem]">{t.docs.colActions}</span>
          </div>
          <ul className="divide-y divide-border">
            {groups.map((g) => (
              <li key={g.latest.groupId}>
                {row(g.latest)}
                {g.older.length > 0 && (
                  <div className="px-5 pb-4">
                    <button
                      type="button"
                      aria-expanded={!!expanded[g.latest.groupId]}
                      onClick={() => setExpanded((e) => ({ ...e, [g.latest.groupId]: !e[g.latest.groupId] }))}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-navy hover:text-gold"
                    >
                      <ChevronDown className={cn("size-4 transition-transform", expanded[g.latest.groupId] && "rotate-180")} />
                      {t.docs.versions} ({g.older.length})
                    </button>
                    {expanded[g.latest.groupId] && (
                      <div className="mt-3 divide-y divide-border border border-border">{g.older.map((d) => row(d, true))}</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <DocumentViewer state={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-navy md:block">
      <span className="text-xs text-muted-foreground md:hidden">{label}</span>
      <span>{children}</span>
    </div>
  );
}
