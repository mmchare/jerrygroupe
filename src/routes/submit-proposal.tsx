import { createFileRoute, ClientOnly } from "@tanstack/react-router";

import { PageHeader } from "@/components/site/PageHeader";
import { ProposalWizard } from "@/components/proposal/ProposalWizard";
import { dictionaries, langFromMatches, pageMeta } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { proposalCategoriesQuery } from "@/lib/queries";

export const Route = createFileRoute("/submit-proposal")({
  loader: ({ context }) => context.queryClient.ensureQueryData(proposalCategoriesQuery),
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.submitTitle, t.meta.submitDescription) };
  },
  component: SubmitProposalPage,
});

function SubmitProposalPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader eyebrow={t.proposal.eyebrow} title={t.proposal.title} lead={t.proposal.lead} />
      <section className="bg-secondary/60 py-14 md:py-20">
        <div className="container-page">
          {/* Country names come from the browser's locale data, so the form renders after load. */}
          <ClientOnly fallback={<div className="mx-auto h-[640px] max-w-3xl animate-pulse border border-border bg-card" />}>
            <ProposalWizard />
          </ClientOnly>
        </div>
      </section>
    </>
  );
}
