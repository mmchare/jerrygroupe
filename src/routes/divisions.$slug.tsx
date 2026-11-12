import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/site/PageHeader";
import { dictionaries, langFromMatches, pageMeta, pick } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { divisionImage } from "@/lib/division-images";
import { siteBasicsQuery } from "@/lib/queries";

export const Route = createFileRoute("/divisions/$slug")({
  loader: async ({ context, params }) => {
    const basics = await context.queryClient.ensureQueryData(siteBasicsQuery);
    const division = basics.divisions.find((d) => d.slug === params.slug);
    if (!division) throw notFound();
    return { division };
  },
  head: ({ matches, loaderData }) => {
    const lang = langFromMatches(matches);
    const t = dictionaries[lang];
    if (!loaderData) return { meta: [{ title: t.divisions.notFoundTitle }, { name: "robots", content: "noindex" }] };
    const d = loaderData.division;
    return { meta: pageMeta(`${pick(d, "name", lang)} — JERRY GROUP`, pick(d, "summary", lang)) };
  },
  notFoundComponent: DivisionNotFound,
  component: DivisionPage,
});

function DivisionNotFound() {
  const { t } = useI18n();
  return (
    <div className="container-page py-32 text-center">
      <h1 className="text-4xl text-navy">{t.divisions.notFoundTitle}</h1>
      <p className="mt-4 text-muted-foreground">{t.divisions.notFoundBody}</p>
      <Button asChild variant="outline-navy" className="mt-8">
        <Link to="/divisions">{t.divisions.backToAll}</Link>
      </Button>
    </div>
  );
}

function DivisionPage() {
  const { t, lang } = useI18n();
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(siteBasicsQuery);
  const division = data.divisions.find((d) => d.slug === slug);
  if (!division) return <DivisionNotFound />;
  const domains = lang === "fr" ? division.domains_fr : division.domains_en;
  const others = data.divisions.filter((d) => d.slug !== slug);

  return (
    <>
      <PageHeader
        eyebrow={t.divisions.internalNote}
        title={pick(division, "name", lang)}
        lead={pick(division, "tagline", lang)}
        image={divisionImage(division.slug)}
      />
      <section className="py-20">
        <div className="container-page grid gap-14 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6 text-lg leading-relaxed text-foreground/80">
            {pick(division, "description", lang)
              .split(/\n\s*\n/)
              .map((para, i) => (
                <p key={i}>{para}</p>
              ))}
          </div>
          <aside className="border border-border bg-card p-8 shadow-card">
            <h2 className="eyebrow">{t.divisions.domains}</h2>
            <ul className="mt-6 space-y-4">
              {domains.map((d) => (
                <li key={d} className="flex items-start gap-3 text-navy">
                  <span aria-hidden className="mt-2.5 h-px w-4 shrink-0 bg-gold" />
                  {d}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
      <section className="bg-navy-gradient py-16 text-ivory">
        <div className="container-page flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="text-3xl text-ivory">{t.divisions.submitTitle}</h2>
            <p className="mt-3 text-ivory/75">{t.divisions.submitBody}</p>
          </div>
          <Button asChild variant="gold" size="xl">
            <Link to="/submit-proposal">{t.divisions.submitCta}</Link>
          </Button>
        </div>
      </section>
      <section className="py-16">
        <div className="container-page">
          <h2 className="eyebrow">{t.divisions.otherDivisions}</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {others.map((d) => (
              <li key={d.id}>
                <Link
                  to="/divisions/$slug"
                  params={{ slug: d.slug }}
                  className="block h-full border border-border bg-card p-5 font-display text-navy transition-colors hover:border-gold"
                >
                  {pick(d, "name", lang)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
