import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/site/PageHeader";
import { dictionaries, langFromMatches, pageMeta, pick, type Lang } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { countryName } from "@/lib/countries";
import { leadershipQuery } from "@/lib/queries";

type Highlight = { value?: string; label_en?: string; label_fr?: string };

type LeadershipMember = {
  id: string;
  name_en: string;
  name_fr: string;
  portrait_url: string | null;
  country_code?: string | null;
  highlights?: unknown;
  [key: string]: unknown;
};

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
  jonathanimerman: "/Jonathan%20imerman.jpeg",
  emirtamimbinhamadalthani: "/Emir%20Tamim%20bin%20Hamad%20Al-Thani.jpg",
  davidsantosmba: "/DAVID%20SANTOS.jpg",
};

const LEADERSHIP_EMAILS: Record<string, string> = {
  drjerryarey: "jerryrey@jerrytradinggroup.com",
  draranmaree: "aranmaree@jerrytradinggroup.com",
  jonathanimerman: "jonathanimerman@jerrytradinggroup.com",
  davidsantosmba: "davidsantos@jerrytradinggroup.com",
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function displayName(member: LeadershipMember, lang: Lang): string {
  const isEmirTamim = [member.name_en, member.name_fr].some((name) =>
    ["Prince Althani of Qatar", "Prince Althani du Qatar"].includes(name),
  );
  return isEmirTamim ? "Emir Tamim bin Hamad Al-Thani" : pick(member, "name", lang);
}

function portraitFor(member: LeadershipMember, name: string): string | null {
  if (member.portrait_url) return member.portrait_url;
  return LOCAL_PORTRAITS[normalizeName(name)] ?? null;
}

function initials(name: string) {
  return name
    .replace(/^(Dr\.?|Prince|Emir)\s+/i, "")
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function flag(code: string): string {
  return code
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function highlightsOf(member: LeadershipMember): Highlight[] {
  return Array.isArray(member.highlights) ? (member.highlights as Highlight[]) : [];
}

function MemberCard({ member, featured }: { member: LeadershipMember; featured?: boolean }) {
  const { t, lang } = useI18n();
  const name = displayName(member, lang);
  const bio = pick(member, "bio", lang);
  const portrait = portraitFor(member, name);
  const email = LEADERSHIP_EMAILS[normalizeName(name)];
  const expertise = pick(member, "expertise", lang)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const highlights = highlightsOf(member);
  const country = member.country_code;

  return (
    <article
      className={`grid border border-border bg-card shadow-card ${
        featured ? "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
      }`}
    >
      {portrait ? (
        <img
          src={portrait}
          alt={name}
          loading={featured ? "eager" : "lazy"}
          className="aspect-[4/5] h-full w-full object-cover object-top"
        />
      ) : (
        <div className="relative grid aspect-[4/5] h-full place-items-center bg-navy-gradient">
          <span className="font-display text-5xl text-gold">{initials(name)}</span>
          <span className="absolute bottom-3 left-3 bg-ivory/10 px-2 py-1 text-[0.65rem] uppercase tracking-wider text-ivory/80">
            {t.leadership.portraitPending}
          </span>
        </div>
      )}
      <div className={featured ? "p-8 md:p-10" : "p-6 md:p-7"}>
        <h2 className={featured ? "text-3xl text-navy" : "text-xl text-navy"}>{name}</h2>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold">{pick(member, "role", lang)}</p>
        {email && (
          <a
            href={`mailto:${email}`}
            className="mt-2 inline-block text-sm text-navy underline decoration-gold/60 underline-offset-4 transition-colors hover:text-gold"
          >
            {email}
          </a>
        )}
        {country && (
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            JERRY GROUP | {countryName(country, lang)} <span aria-hidden>{flag(country)}</span>
          </p>
        )}
        <span className="gold-rule mt-5" />
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{bio || t.leadership.bioPending}</p>

        {highlights.length > 0 && (
          <div className="mt-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-navy">{t.leadership.achievements}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {highlights.map((h, i) => (
                <div key={i} className="border-l-2 border-gold bg-muted/40 px-3 py-2">
                  <dt className="font-display text-xl text-navy">{h.value}</dt>
                  <dd className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    {(lang === "fr" ? h.label_fr : h.label_en) ?? h.label_en}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {expertise.length > 0 && (
          <div className="mt-6">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-navy">{t.leadership.expertise}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {expertise.map((e) => (
                <li key={e} className="border border-gold/40 px-2.5 py-1 text-xs text-navy">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

function LeadershipPage() {
  const { t } = useI18n();
  const { data } = useSuspenseQuery(leadershipQuery);
  const [first, ...rest] = data as LeadershipMember[];
  return (
    <>
      <PageHeader eyebrow={t.leadership.eyebrow} title={t.leadership.title} lead={t.leadership.lead} />
      <section className="py-20">
        <div className="container-page space-y-8">
          {first && <MemberCard member={first} featured />}
          <div className="grid gap-8 lg:grid-cols-2">
            {rest.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
