import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DossierView } from "@/components/tracking/DossierView";
import { PortalShell, PortalSkeleton, PortalUnavailable } from "@/components/tracking/PortalShell";
import { dictionaries, langFromMatches } from "@/i18n";
import { privateHead, supplierPortalQuery } from "@/lib/tracking-queries";

// Private supplier space: rendered in the browser only, never indexed, never cached by the server.
export const Route = createFileRoute("/supplier/portal/$token")({
  ssr: false,
  loader: ({ context, params }) => context.queryClient.ensureQueryData(supplierPortalQuery(params.token)),
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return privateHead(t.meta.portalTitle, t.meta.privateDescription);
  },
  pendingComponent: PortalSkeleton,
  component: SupplierPortalPage,
});

function SupplierPortalPage() {
  const { token } = Route.useParams();
  const { data: result } = useSuspenseQuery(supplierPortalQuery(token));
  if (!result.ok) return <PortalUnavailable reason={result.reason} />;
  return (
    <PortalShell token={token} data={result.data} active="dossier">
      <DossierView token={token} data={result.data} />
    </PortalShell>
  );
}
