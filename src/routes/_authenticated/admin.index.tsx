import { createFileRoute } from "@tanstack/react-router";

import { AdminProposals } from "@/components/admin/AdminProposals";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Propositions | Administration JERRY GROUP" },
      { name: "description", content: "Examen et gestion des propositions reçues par JERRY GROUP." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:title", content: "Propositions | Administration JERRY GROUP" },
      { property: "og:description", content: "Espace privé de gestion des propositions JERRY GROUP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProposals,
});
