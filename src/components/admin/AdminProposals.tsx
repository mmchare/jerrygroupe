import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FileText, RefreshCw, Search } from "lucide-react";

import { StatusBadge } from "@/components/tracking/StatusBadge";
import { formatDate } from "@/components/tracking/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/I18nProvider";
import { adminProposalsQuery } from "@/lib/admin-queries";
import { PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/tracking-rules";

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Erreur inconnue lors du chargement.";
}

export function AdminProposals() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ProposalStatus>("all");
  const { data, isPending, error, refetch, isFetching } = useQuery(
    adminProposalsQuery(search, status === "all" ? undefined : status),
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["admin", "proposals"] });
    await refetch();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Traitement des opportunités</p>
        <h1 className="mt-3 text-4xl text-navy">Propositions reçues</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Examinez les offres, échangez avec les fournisseurs et suivez chaque décision.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total des propositions" value={data?.total ?? 0} />
        <Metric label={t.statuses.received} value={data?.counts.received ?? 0} />
        <Metric label={t.statuses.under_review} value={data?.counts.under_review ?? 0} />
        <Metric label={t.statuses.additional_info_required} value={data?.counts.additional_info_required ?? 0} />
      </div>

      <div className="flex flex-col gap-3 border border-border bg-card p-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Référence, nom, e-mail, société ou produit…" className="h-11 pl-10" aria-label="Rechercher une proposition" />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as "all" | ProposalStatus)}>
          <SelectTrigger className="h-11 md:w-72" aria-label="Filtrer par statut"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {PROPOSAL_STATUSES.map((value) => <SelectItem key={value} value={value}>{t.statuses[value]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="border border-border bg-card p-12 text-center text-muted-foreground">Chargement des propositions…</div>
      ) : error ? (
        <div role="alert" className="border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <p className="font-semibold">Impossible de charger les propositions.</p>
          <p className="mt-2 text-sm">{describeError(error)}</p>
          <Button type="button" variant="outline-navy" className="mt-4" disabled={isFetching} onClick={() => void refresh()}>
            <RefreshCw className={isFetching ? "animate-spin" : ""} /> Actualiser
          </Button>
        </div>
      ) : data?.proposals.length === 0 ? (
        <div className="border border-dashed border-input bg-card p-12 text-center">
          <FileText className="mx-auto size-8 text-gold" aria-hidden />
          <p className="mt-4 text-muted-foreground">Aucune proposition ne correspond à cette recherche.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border bg-card shadow-card">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-border bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-4 font-semibold">Référence</th>
                <th className="px-5 py-4 font-semibold">Proposant</th>
                <th className="px-5 py-4 font-semibold">Proposition</th>
                <th className="px-5 py-4 font-semibold">Catégorie</th>
                <th className="px-5 py-4 font-semibold">Statut</th>
                <th className="px-5 py-4 font-semibold">Reçue le</th>
                <th className="px-5 py-4"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.proposals.map((proposal) => (
                <tr key={proposal.id} className="align-middle hover:bg-secondary/30">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-navy">{proposal.reference}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-navy">{proposal.full_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{proposal.company_name || proposal.email}</p>
                  </td>
                  <td className="max-w-64 px-5 py-4">
                    <p className="truncate font-medium text-navy">{proposal.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{proposal.country_code} · {proposal.city}</p>
                  </td>
                  <td className="max-w-52 px-5 py-4 text-navy/80">{proposal.category.fr || proposal.category.en}</td>
                  <td className="px-5 py-4"><StatusBadge status={proposal.status} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-navy/75">{formatDate(proposal.created_at, "fr")}</td>
                  <td className="px-5 py-4 text-right">
                    <Button asChild size="sm" variant="outline-navy">
                      <Link to="/admin/proposals/$proposalId" params={{ proposalId: proposal.id }}>Examiner <ArrowRight /></Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t-2 border-gold bg-card p-5 shadow-card">
      <p className="text-3xl font-semibold text-navy">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
