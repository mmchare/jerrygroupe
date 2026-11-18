import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Mail, MessageSquare, Phone } from "lucide-react";

import { AdminDocumentManager } from "./AdminDocumentManager";
import { AdminFileButtons } from "./AdminFileButtons";
import { AdminMessageComposer } from "./AdminMessageComposer";
import { AdminStatusEditor } from "./AdminStatusEditor";
import { StatusBadge } from "@/components/tracking/StatusBadge";
import { formatDate, formatSize } from "@/components/tracking/format";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import type { AdminProposalDetail as Proposal } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export function AdminProposalDetail({ proposal }: { proposal: Proposal }) {
  const { t } = useI18n();
  const commercial = [
    ["Pays d’origine", proposal.originCountryCode],
    ["Quantité", proposal.quantity === null ? null : `${proposal.quantity} ${proposal.unit ?? ""}`.trim()],
    ["Prix demandé", proposal.askingPrice === null ? null : `${proposal.askingPrice} ${proposal.currency ?? ""}`.trim()],
    ["Condition", proposal.productCondition],
    ["Disponibilité", proposal.availability],
    ["Lieu de livraison", proposal.deliveryLocation],
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" className="mb-5 -ml-3 text-navy">
          <Link to="/admin"><ArrowLeft /> Retour aux propositions</Link>
        </Button>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-sm font-semibold text-gold">{proposal.reference}</p>
            <h1 className="mt-2 text-4xl text-navy">{proposal.title}</h1>
            <p className="mt-3 text-muted-foreground">Reçue le {formatDate(proposal.createdAt, "fr", true)} · {proposal.category.fr || proposal.category.en}</p>
          </div>
          <StatusBadge status={proposal.status} className="self-start" />
        </div>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-8">
          <section className="border border-border bg-card p-6 shadow-card md:p-8" aria-labelledby="proposal-details-title">
            <h2 id="proposal-details-title" className="text-2xl text-navy">Détails de la proposition</h2>
            <p className="mt-5 whitespace-pre-line leading-relaxed text-navy/85">{proposal.description}</p>
            <dl className="mt-7 grid gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-2">
              {commercial.map(([label, value]) => <Info key={label} label={label} value={value ?? "—"} />)}
            </dl>
            {proposal.additionalInfo && (
              <div className="mt-6 border-l-2 border-gold bg-gold-soft/40 p-4">
                <h3 className="text-sm font-semibold text-navy">Informations complémentaires</h3>
                <p className="mt-2 whitespace-pre-line text-sm text-navy/80">{proposal.additionalInfo}</p>
              </div>
            )}
            {Object.keys(proposal.extraAnswers).length > 0 && (
              <dl className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
                {Object.entries(proposal.extraAnswers).map(([key, value]) => (
                  <Info key={key} label={key.replaceAll("_", " ")} value={typeof value === "object" ? JSON.stringify(value) : String(value)} />
                ))}
              </dl>
            )}
          </section>

          <section className="border border-border bg-card p-6 shadow-card md:p-8" aria-labelledby="attachments-title">
            <h2 id="attachments-title" className="text-2xl text-navy">Pièces jointes</h2>
            <div className="mt-5 space-y-3">
              {proposal.attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>
              ) : (
                proposal.attachments.map((file) => (
                  <div key={file.id} className="flex flex-col gap-3 border border-border p-3 sm:flex-row sm:items-center">
                    <FileText className="size-5 shrink-0 text-gold" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-navy">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatSize(file.size)} · {formatDate(file.at, "fr")}{file.messageId ? " · Réponse du fournisseur" : ""}</p>
                    </div>
                    <AdminFileButtons proposalId={proposal.id} kind="attachment" id={file.id} fileName={file.name} />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="border border-border bg-card p-6 shadow-card md:p-8" aria-labelledby="conversation-title">
            <h2 id="conversation-title" className="flex items-center gap-2 text-2xl text-navy"><MessageSquare className="text-gold" /> Conversation</h2>
            <div className="mt-5 space-y-4">
              {proposal.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun message direct pour le moment.</p>
              ) : (
                proposal.messages.map((message) => (
                  <article key={message.id} className={cn("border p-4", message.direction === "from_supplier" ? "border-gold/40 bg-gold-soft/30" : "border-navy/15 bg-secondary/30")}>
                    <p className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wider text-navy">{message.direction === "from_supplier" ? "Fournisseur" : "JERRY GROUP"}</span>
                      {formatDate(message.at, "fr", true)}
                    </p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-navy">{message.body}</p>
                  </article>
                ))
              )}
            </div>
            <AdminMessageComposer proposalId={proposal.id} />
          </section>
        </div>

        <aside className="space-y-8">
          <AdminStatusEditor key={`${proposal.id}-${proposal.status}`} proposalId={proposal.id} currentStatus={proposal.status} />

          <section className="border border-border bg-card p-6 shadow-card">
            <h2 className="text-xl text-navy">Coordonnées du proposant</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <Info label="Nom" value={proposal.fullName} />
              <Info label="Société" value={proposal.companyName ?? "—"} />
              <Info label="Type" value={proposal.proposerType} />
              <Info label="Localisation" value={`${proposal.city}, ${proposal.countryCode}`} />
              <Info label="Langue préférée" value={proposal.preferredLanguage.toUpperCase()} />
            </dl>
            <div className="mt-5 space-y-2 border-t border-border pt-5">
              <a href={`mailto:${proposal.email}`} className="flex items-center gap-2 break-all text-sm text-navy hover:text-gold"><Mail className="size-4 shrink-0" /> {proposal.email}</a>
              <a href={`https://wa.me/${proposal.whatsapp.replace("+", "")}`} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 text-sm text-navy hover:text-gold"><Phone className="size-4 shrink-0" /> {proposal.whatsapp}</a>
            </div>
          </section>

          <section className="border border-border bg-card p-6 shadow-card">
            <h2 className="text-xl text-navy">Historique des statuts</h2>
            <ol className="mt-5 space-y-5">
              {[...proposal.history].reverse().map((item) => (
                <li key={item.id} className="border-l-2 border-gold/50 pl-4">
                  <p className="text-sm font-semibold text-navy">{t.statuses[item.status]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.at, "fr", true)}</p>
                  {item.supplierMessage && <p className="mt-2 text-xs leading-relaxed text-navy/75">Message : {item.supplierMessage}</p>}
                  {item.internalNote && <p className="mt-2 bg-secondary p-2 text-xs leading-relaxed text-navy/75">Note interne : {item.internalNote}</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <AdminDocumentManager proposalId={proposal.id} documents={proposal.documents} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-navy">{value}</dd>
    </div>
  );
}
