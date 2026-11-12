import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { DivisionCard } from "@/components/site/DivisionCard";
import { PageHeader } from "@/components/site/PageHeader";
import { dictionaries, langFromMatches, pageMeta } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { siteBasicsQuery } from "@/lib/queries";
import heroImage from "@/assets/division-global-capital.jpg";

export const Route = createFileRoute("/divisions/")({
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.divisionsTitle, t.meta.divisionsDescription) };
  },
  component: DivisionsPage,
});

function DivisionsPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(siteBasicsQuery);
  return (
    <>
      <PageHeader eyebrow={t.divisions.eyebrow} title={t.divisions.title} lead={t.divisions.lead} image={heroImage} />
      <section className="py-20">
        <div className="container-page grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.divisions.map((d, i) => (
            <DivisionCard key={d.id} division={d} index={i} />
          ))}
        </div>
      </section>
    </>
  );
}
