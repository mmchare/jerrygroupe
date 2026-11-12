import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/PageHeader";
import { dictionaries, langFromMatches, pageMeta } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { siteBasicsQuery } from "@/lib/queries";

export const Route = createFileRoute("/contact")({
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.contactTitle, t.meta.contactDescription) };
  },
  component: ContactPage,
});

function ContactPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(siteBasicsQuery);
  const s = (k: string) => data.settings[k]?.[lang] ?? "";
  const blocks: [string, string][] = [
    [t.contact.hqTitle, s("operational_hq")],
    [t.contact.registeredTitle, s("registered_office")],
    [t.contact.entityTitle, `${s("legal_name")} · ${t.about.companyNumber} ${s("company_number")}`],
  ];
  return (
    <>
      <PageHeader eyebrow={t.contact.eyebrow} title={t.contact.title} lead={t.contact.lead} />
      <section className="py-20">
        <div className="container-page grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {blocks.map(([title, value]) => (
            <div key={title} className="border-t-2 border-gold bg-card p-7 shadow-card">
              <h2 className="eyebrow">{title}</h2>
              <p className="mt-4 leading-relaxed text-navy">{value}</p>
            </div>
          ))}
          <div className="border-t-2 border-gold bg-card p-7 shadow-card">
            <h2 className="eyebrow">{t.contact.websiteTitle}</h2>
            <a href={s("website")} className="mt-4 block text-navy underline-offset-4 hover:underline">
              {s("website").replace(/^https?:\/\//, "")}
            </a>
          </div>
        </div>
        <div className="container-page mt-12">
          <div className="flex flex-col items-start justify-between gap-6 bg-navy-gradient p-10 text-ivory md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl text-ivory">{t.contact.proposalTitle}</h2>
              <p className="mt-3 text-ivory/75">{t.contact.proposalBody}</p>
            </div>
            <Button asChild variant="gold" size="xl">
              <Link to="/submit-proposal">{t.contact.proposalCta}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
