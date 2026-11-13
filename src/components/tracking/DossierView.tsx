import { Link } from "@tanstack/react-router";
import { Download, FileText, FolderLock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { format, type Lang } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import type { PortalData, PortalFile } from "@/lib/tracking.functions";
import { cn } from "@/lib/utils";
import { formatDate, formatSize } from "./format";
import { ReplyForm } from "./ReplyForm";
import { StatusBadge } from "./StatusBadge";
import { useFileLink } from "./useFileLink";

export function DossierView({ token, data }: { token: string; data: PortalData }) {
  const { t, lang } = useI18n();
  const { download, busy } = useFileLink(token);
  const published = data.documents.filter((d) => d.status === "published").length;

  const fileList = (files: PortalFile[]) => (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 border border-border bg-background px-3 py-2">
          <FileText className="size-4 shrink-0 text-navy/60" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-navy">{f.name}</span>
          <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
          <button
            type="button"
            onClick={() => void download("attachment", f.id)}
            disabled={!!busy}
            className="cursor-pointer p-1 text-navy/70 hover:text-gold disabled:opacity-50"
            aria-label={`${t.portal.download} ${f.name}`}
          >
            <Download className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <section className="border border-border bg-card p-6 shadow-card md:p-8">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Info label={t.portal.reference} value={data.reference} mono />
            <Info label={t.portal.submittedOn} value={formatDate(data.createdAt, lang, true)} />
            <Info label={t.portal.category} value={lang === "fr" ? data.category.fr : data.category.en} />
            <Info label={t.portal.product} value={data.title} />
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t.portal.status}</dt>
              <dd className="mt-2"><StatusBadge status={data.status} /></dd>
            </div>
            <Info label={t.portal.lastUpdate} value={formatDate(data.lastUpdate, lang, true)} />
          </dl>
          <p className="mt-6 border-l-2 border-gold bg-gold-soft/50 px-4 py-3 text-sm text-navy">{t.statusHelp[data.status]}</p>
        </section>

        <section aria-labelledby="messages-title">
          <h2 id="messages-title" className="text-2xl text-navy">{t.portal.messagesTitle}</h2>
          {data.messages.length === 0 ? (
            <p className="mt-4 border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">{t.portal.noMessages}</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {data.messages.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "border p-5",
                    m.direction === "to_supplier" ? "border-navy/15 bg-card" : "ml-6 border-gold/40 bg-gold-soft/40 md:ml-12",
                  )}
                >
                  <p className="flex items-center justify-between gap-4 text-xs">
                    <span className={cn("font-semibold uppercase tracking-wider", m.direction === "to_supplier" ? "text-gold" : "text-navy")}>
                      {m.direction === "to_supplier" ? t.portal.fromGroup : t.portal.fromYou}
                    </span>
                    <span className="text-muted-foreground">{formatDate(m.at, lang, true)}</span>
                  </p>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-navy">{m.body}</p>
                  {m.files.length > 0 && <div className="mt-4">{fileList(m.files)}</div>}
                </li>
              ))}
            </ol>
          )}
        </section>

        {data.canReply && <ReplyForm token={token} />}

        <section aria-labelledby="files-title">
          <h2 id="files-title" className="text-2xl text-navy">{t.portal.submittedFilesTitle}</h2>
          <div className="mt-4">
            {data.submittedFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.portal.noSubmittedFiles}</p>
            ) : (
              fileList(data.submittedFiles)
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-8">
        <section className="border border-navy bg-navy p-6 text-ivory">
          <FolderLock className="size-7 text-gold" aria-hidden />
          <h2 className="mt-4 text-xl text-ivory">{t.portal.documentsTeaserTitle}</h2>
          <p className="mt-2 text-sm text-ivory/75">
            {published > 0 ? format(t.portal.documentsTeaserBody, { count: published }) : t.portal.documentsTeaserEmpty}
          </p>
          <Button asChild variant="gold" className="mt-5 w-full">
            <Link to="/supplier/documents/$token" params={{ token }}>{t.portal.documentsTeaserCta}</Link>
          </Button>
        </section>

        <section aria-labelledby="history-title" className="border border-border bg-card p-6">
          <h2 id="history-title" className="text-xl text-navy">{t.portal.historyTitle}</h2>
          <ol className="mt-5 space-y-0">
            {[...data.history].reverse().map((h, i) => (
              <HistoryItem key={`${h.at}-${i}`} label={t.statuses[h.status]} at={h.at} lang={lang} current={i === 0} />
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1.5 text-navy", mono ? "font-mono text-sm" : "font-medium")}>{value || "—"}</dd>
    </div>
  );
}

function HistoryItem({ label, at, lang, current }: { label: string; at: string; lang: Lang; current: boolean }) {
  return (
    <li className="relative border-l border-border pb-5 pl-5 last:pb-0">
      <span
        className={cn(
          "absolute -left-[5px] top-1 size-2.5 rounded-full border",
          current ? "border-gold bg-gold" : "border-navy/30 bg-card",
        )}
        aria-hidden
      />
      <p className={cn("text-sm", current ? "font-semibold text-navy" : "text-navy/80")}>{label}</p>
      <p className="text-xs text-muted-foreground">{formatDate(at, lang, true)}</p>
    </li>
  );
}
