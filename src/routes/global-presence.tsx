import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/site/PageHeader";
import { dictionaries, langFromMatches, pageMeta, pick } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { countryName } from "@/lib/countries";
import { presenceQuery } from "@/lib/queries";
import heroImage from "@/assets/division-medical-marine.jpg";

export const Route = createFileRoute("/global-presence")({
  loader: ({ context }) => context.queryClient.ensureQueryData(presenceQuery),
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.presenceTitle, t.meta.presenceDescription) };
  },
  component: PresencePage,
});

const REGIONS = ["europe", "africa", "americas", "asia", "oceania"] as const;

function PresencePage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(presenceQuery);
  return (
    <>
      <PageHeader eyebrow={t.presence.eyebrow} title={t.presence.title} lead={t.presence.lead} image={heroImage} />
      <section className="py-20">
        <div className="container-page grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {REGIONS.map((region) => {
            const items = data.filter((p) => p.region === region);
            if (items.length === 0) return null;
            return (
              <div key={region} className="border border-border bg-card p-7 shadow-card">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-2xl text-navy">{t.presence.regions[region]}</h2>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {items.length} {items.length > 1 ? t.presence.countries : t.presence.country}
                  </span>
                </div>
                <span className="gold-rule mt-4" />
                <ul className="mt-6 space-y-4">
                  {items.map((p) => (
                    <li key={p.id}>
                      <p className="font-medium text-navy">
                        {countryName(p.country_code, lang)}
                        {p.city ? ` — ${p.city}` : ""}
                      </p>
                      {p.presence_type && (
                        <p className="mt-0.5 text-xs uppercase tracking-wider text-gold">
                          {pick(p, "note", lang) || t.presence.types[p.presence_type as keyof typeof t.presence.types]}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="container-page mt-10 text-sm text-muted-foreground">{t.presence.notice}</p>
      </section>
    </>
  );
}
