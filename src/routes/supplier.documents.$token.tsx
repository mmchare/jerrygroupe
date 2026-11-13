import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DocumentCenter } from "@/components/tracking/DocumentCenter";
import { PortalShell, PortalSkeleton, PortalUnavailable } from "@/components/tracking/PortalShell";
import { dictionaries, langFromMatches } from "@/i18n";
import { privateHead, supplierPortalQuery } from "@/lib/tracking-queries";

// Private supplier space: rendered in the browser only, never indexed, never cached by the server.
export const Route = createFileRoute("/supplier/documents/$token")({
  ssr: false,
  loader: ({ context, params }) => context.queryClient.ensureQueryData(supplierPortalQuery(params.token)),
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return privateHead(t.meta.documentsTitle, t.meta.privateDescription);
  },
  pendingComponent: PortalSkeleton,
  component: SupplierDocumentsPage,
});

function SupplierDocumentsPage() {
  const { token } = Route.useParams();
  const { data: result } = useSuspenseQuery(supplierPortalQuery(token));
  if (!result.ok) return <PortalUnavailable reason={result.reason} />;
  return (
    <PortalShell token={token} data={result.data} active="documents">
      <DocumentCenter token={token} documents={result.data.documents} />
    </PortalShell>
  );
}
