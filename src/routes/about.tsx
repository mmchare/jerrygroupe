import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeading } from "@/components/site/PageHeader";
import { dictionaries, langFromMatches, pageMeta } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { siteBasicsQuery } from "@/lib/queries";
import heroImage from "@/assets/hero-london.jpg";

export const Route = createFileRoute("/about")({
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.aboutTitle, t.meta.aboutDescription) };
  },
  component: AboutPage,
});

function AboutPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(siteBasicsQuery);
  const s = (k: string) => data.settings[k]?.[lang] ?? "";
  const facts: [string, string][] = [
    [t.about.legalName, s("legal_name")],
    [t.about.companyNumber, s("company_number")],
    [t.about.legalForm, s("legal_form")],
    [t.about.jurisdiction, s("jurisdiction")],
    [t.about.incorporation, s("incorporation_date")],
    [t.about.registeredOffice, s("registered_office")],
    [t.about.operationalHq, s("operational_hq")],
    [t.about.president, s("president")],
  ];
  const principles = [
    [t.about.p1Title, t.about.p1Body],
    [t.about.p2Title, t.about.p2Body],
    [t.about.p3Title, t.about.p3Body],
  ];
  return (
    <>
      <PageHeader eyebrow={t.about.eyebrow} title={t.about.title} lead={t.about.lead} image={heroImage} />
      <section className="py-20">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <p className="text-lg leading-relaxed text-foreground/80">{t.about.body1}</p>
          <p className="text-lg leading-relaxed text-foreground/80">{t.about.body2}</p>
        </div>
        <div className="container-page mt-16 grid gap-6 md:grid-cols-3">
          {principles.map(([title, body]) => (
            <div key={title} className="border-t-2 border-gold bg-card p-7 shadow-card">
              <h3 className="text-xl text-navy">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-t border-border bg-secondary/60 py-20">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading eyebrow={t.about.legalTitle} title={s("legal_name")} body={t.about.legalIntro} />
            <Button asChild variant="outline-navy" className="mt-8">
              <Link to="/leadership">{t.about.leadershipCta}</Link>
            </Button>
          </div>
          <dl className="divide-y divide-border border border-border bg-card">
            {facts.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-6 py-4 sm:grid-cols-[14rem_1fr]">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="text-navy">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
