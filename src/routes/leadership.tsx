import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/site/PageHeader";
import { dictionaries, langFromMatches, pageMeta, pick } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { leadershipQuery } from "@/lib/queries";

export const Route = createFileRoute("/leadership")({
  loader: ({ context }) => context.queryClient.ensureQueryData(leadershipQuery),
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.leadershipTitle, t.meta.leadershipDescription) };
  },
  component: LeadershipPage,
});

const LOCAL_PORTRAITS: Record<string, string> = {
  drjerryarey: "/Dr.%20Jerry%20A.%20Rey.jpeg",
  draranmaree: "/Dr%20Aran%20maree.jpeg",
  jonathanimer man: "/Jonathan%20imerman.jpeg",
};

function portraitFor(name: string, portraitUrl: string | null): string | null {
  if (portraitUrl) return portraitUrl;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return LOCAL_PORTRAITS[key] ?? null;
}

function initials(name: string) {
  return name
    .replace(/^(Dr\.?|Prince)\s+/i, "")
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function LeadershipPage() {
  const { t, lang } = useI18n();
  const { data } = useSuspenseQuery(leadershipQuery);
  return (
    <>
      <PageHeader eyebrow={t.leadership.eyebrow} title={t.leadership.title} lead={t.leadership.lead} />
      <section className="py-20">
        <div className="container-page grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((m) => {
            const name = pick(m, "name", lang);
            const bio = pick(m, "bio", lang);
            const portrait = portraitFor(name, m.portrait_url);
            return (
              <article key={m.id} className="border border-border bg-card shadow-card">
                {portrait ? (
                  <img src={portrait} alt={name} className="aspect-[4/5] w-full object-cover" />
                ) : (
                  <div className="relative grid aspect-[4/5] place-items-center bg-navy-gradient">
                    <span className="font-display text-5xl text-gold">{initials(name)}</span>
                    <span className="absolute bottom-3 left-3 bg-ivory/10 px-2 py-1 text-[0.65rem] uppercase tracking-wider text-ivory/80">
                      {t.leadership.portraitPending}
                    </span>
                  </div>
                )}
                <div className="p-6">
                  <h2 className="text-xl text-navy">{name}</h2>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-gold">{pick(m, "role", lang)}</p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{bio || t.leadership.bioPending}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
