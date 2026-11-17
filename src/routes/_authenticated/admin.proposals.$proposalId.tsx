import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminProposalDetail } from "@/components/admin/AdminProposalDetail";
import { adminProposalQuery } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/admin/proposals/$proposalId")({
  head: () => ({
    meta: [
      { title: "Dossier fournisseur | Administration JERRY GROUP" },
      { name: "description", content: "Examen privé d’une proposition et publication de documents fournisseur." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:title", content: "Dossier fournisseur | Administration JERRY GROUP" },
      { property: "og:description", content: "Espace privé de traitement d’une proposition JERRY GROUP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProposalPage,
});

function AdminProposalPage() {
  const { proposalId } = Route.useParams();
  const { data, isPending, error, refetch } = useQuery(adminProposalQuery(proposalId));
  if (isPending) return <div className="border border-border bg-card p-12 text-center text-muted-foreground">Chargement du dossier…</div>;
  if (error || !data) {
    return (
      <div role="alert" className="border border-destructive/30 bg-destructive/10 p-8 text-center">
        <p className="text-destructive">Ce dossier est introuvable ou n’a pas pu être chargé.</p>
        <button type="button" onClick={() => void refetch()} className="mt-4 text-sm font-semibold text-navy underline underline-offset-4">Réessayer</button>
      </div>
    );
  }
  return <AdminProposalDetail proposal={data} />;
}
