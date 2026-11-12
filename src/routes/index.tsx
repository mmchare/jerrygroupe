import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Gem, Landmark, Leaf, LineChart, Waves, Fuel } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DivisionCard } from "@/components/site/DivisionCard";
import { SectionHeading } from "@/components/site/PageHeader";
import { langFromMatches, dictionaries, pageMeta, pick } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { countryName } from "@/lib/countries";
import { presenceQuery, proposalCategoriesQuery, siteBasicsQuery } from "@/lib/queries";
import heroImage from "@/assets/hero-london.jpg";
import artImage from "@/assets/division-art-heritage.jpg";
import philImage from "@/assets/division-philanthropy.jpg";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(presenceQuery),
      context.queryClient.ensureQueryData(proposalCategoriesQuery),
    ]),
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.homeTitle, t.meta.homeDescription) };
  },
  component: HomePage,
});

const REGION_ORDER = ["europe", "africa", "americas", "asia", "oceania"] as const;

/** Categories highlighted on the home page, by slug, with an icon each. */
const FEATURED_CATEGORIES = [
  { slug: "artworks-collectibles", icon: Gem },
  { slug: "marine-products", icon: Waves },
  { slug: "petroleum-energy", icon: Fuel },
  { slug: "investment-opportunities", icon: LineChart },
  { slug: "other-business", icon: Landmark },
] as const;

function HomePage() {
  const { t, lang } = useI18n();
  const { data: basics } = useSuspenseQuery(siteBasicsQuery);
  const { data: presence } = useSuspenseQuery(presenceQuery);
  const { data: categories } = useSuspenseQuery(proposalCategoriesQuery);

  const regions = REGION_ORDER.map((region) => ({
    region,
    items: presence.filter((p) => p.region === region),
  })).filter((r) => r.items.length > 0);

  const artDivision = basics.divisions.find((d) => d.slug === "art-heritage");
  const philDivision = basics.divisions.find((d) => d.slug === "philanthropy");

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy text-ivory">
        <img
          src={heroImage}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 -z-20 size-full object-cover object-[70%_center]"
        />
        <div className="absolute inset-0 -z-10 bg-hero-overlay" />
        <div className="container-page flex min-h-[calc(100svh-5rem)] max-h-[860px] items-center py-24">
          <div className="max-w-2xl animate-fade-up">
            <p className="eyebrow">{t.home.heroEyebrow}</p>
            <h1 className="mt-6 text-5xl font-medium leading-[1.05] text-ivory sm:text-6xl lg:text-7xl">
              {t.home.heroTitle}
            </h1>
            <span className="gold-rule mt-8" />
            <p className="mt-8 max-w-xl text-base leading-relaxed text-ivory/80 md:text-lg">
              {t.home.heroSubtitle}
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="gold" size="xl">
                <Link to="/submit-proposal">{t.home.heroSubmit}</Link>
              </Button>
              <Button asChild variant="outline-light" size="xl">
                <Link to="/about">{t.home.heroDiscover}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Group introduction */}
      <section className="py-20 md:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <SectionHeading eyebrow={t.home.introEyebrow} title={t.home.introTitle} />
          <div>
            <p className="text-lg leading-relaxed text-foreground/80">{t.home.introBody}</p>
            <Link
              to="/about"
              className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy hover:text-gold"
            >
              {t.home.introCta} <ArrowRight className="size-4" />
            </Link>
            <dl className="mt-12 grid grid-cols-3 border-t border-border pt-8">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t.home.factHq}</dt>
                <dd className="mt-2 font-display text-2xl text-navy md:text-3xl">{t.home.factHqValue}</dd>
              </div>
              <div className="border-l border-border pl-5">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t.home.factDivisions}</dt>
                <dd className="mt-2 font-display text-2xl text-navy md:text-3xl">{basics.divisions.length}</dd>
              </div>
              <div className="border-l border-border pl-5">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{t.home.factRegions}</dt>
                <dd className="mt-2 font-display text-2xl text-navy md:text-3xl">{regions.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Divisions */}
      <section className="border-t border-border bg-secondary/60 py-20 md:py-28">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow={t.home.divisionsEyebrow} title={t.home.divisionsTitle} body={t.home.divisionsBody} />
            <Button asChild variant="outline-navy" className="self-start md:self-auto">
              <Link to="/divisions">{t.home.divisionsCta}</Link>
            </Button>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {basics.divisions.map((d, i) => (
              <DivisionCard key={d.id} division={d} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Global presence */}
      <section className="bg-navy-gradient py-20 text-ivory md:py-28">
        <div className="container-page grid gap-14 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading tone="light" eyebrow={t.home.presenceEyebrow} title={t.home.presenceTitle} body={t.home.presenceBody} />
            <Button asChild variant="outline-light" className="mt-10">
              <Link to="/global-presence">{t.home.presenceCta}</Link>
            </Button>
          </div>
          <div className="grid gap-px overflow-hidden border border-ivory/10 bg-ivory/10 sm:grid-cols-2">
            {regions.map(({ region, items }) => (
              <div key={region} className="bg-navy/80 p-6">
                <h3 className="font-display text-xl text-gold">{t.presence.regions[region]}</h3>
                <ul className="mt-4 space-y-2 text-sm text-ivory/80">
                  {items.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3">
                      <span>{countryName(p.country_code, lang)}</span>
                      {p.presence_type === "headquarters" && (
                        <span className="text-[0.65rem] uppercase tracking-wider text-gold">{pick(p, "note", lang)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global business opportunities */}
      <section className="py-20 md:py-28">
        <div className="container-page">
          <div className="relative overflow-hidden border border-gold/50 bg-card p-8 shadow-card md:p-14">
            <div aria-hidden className="absolute -right-24 -top-24 size-72 rounded-full bg-gold-soft blur-2xl" />
            <div className="relative grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div>
                <p className="eyebrow">{t.home.oppEyebrow}</p>
                <h2 className="mt-4 text-4xl font-medium leading-tight text-navy md:text-5xl">{t.home.oppTitle}</h2>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-foreground/75">{t.home.oppBody}</p>
                <Button asChild variant="gold" size="xl" className="mt-10">
                  <Link to="/submit-proposal">{t.home.oppCta}</Link>
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">{t.home.oppNoAccount}</p>
              </div>
              <ul className="grid gap-3">
                {FEATURED_CATEGORIES.map(({ slug, icon: Icon }) => {
                  const cat = categories.find((c) => c.slug === slug);
                  if (!cat) return null;
                  return (
                    <li key={slug} className="flex items-center gap-4 border border-border bg-background px-5 py-4">
                      <Icon className="size-5 shrink-0 text-gold" aria-hidden />
                      <span className="font-medium text-navy">{pick(cat, "name", lang)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Art & heritage */}
      <FeatureSplit
        image={artImage}
        eyebrow={t.home.artEyebrow}
        title={t.home.artTitle}
        body={t.home.artBody}
        slug={artDivision?.slug}
        cta={artDivision ? pick(artDivision, "name", lang) : undefined}
      />

      {/* Philanthropy */}
      <FeatureSplit
        reverse
        image={philImage}
        eyebrow={t.home.philEyebrow}
        title={t.home.philTitle}
        body={t.home.philBody}
        slug={philDivision?.slug}
        cta={philDivision ? pick(philDivision, "name", lang) : undefined}
        icon
      />

      {/* Contact */}
      <section className="border-t border-border bg-secondary/60 py-20">
        <div className="container-page flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="eyebrow">{t.home.contactEyebrow}</p>
            <h2 className="mt-3 text-3xl font-medium text-navy">{t.home.contactTitle}</h2>
            <p className="mt-3 text-muted-foreground">
              {basics.settings["operational_hq"]?.[lang]} · {basics.settings["legal_name"]?.[lang]}
            </p>
          </div>
          <Button asChild variant="outline-navy" size="xl">
            <Link to="/contact">{t.home.contactCta}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function FeatureSplit({
  image,
  eyebrow,
  title,
  body,
  slug,
  cta,
  reverse,
  icon,
}: {
  image: string;
  eyebrow: string;
  title: string;
  body: string;
  slug?: string | undefined;
  cta?: string | undefined;
  reverse?: boolean;
  icon?: boolean;
}) {
  return (
    <section className="py-16 md:py-20">
      <div className={`container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-20 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="relative">
          <img src={image} alt="" loading="lazy" width={1280} height={896} className="aspect-[4/3] w-full object-cover" />
          <span aria-hidden className={`absolute -bottom-4 hidden h-24 w-24 border border-gold lg:block ${reverse ? "-left-4" : "-right-4"}`} />
        </div>
        <div>
          <p className="eyebrow inline-flex items-center gap-2">
            {icon && <Leaf className="size-3.5" aria-hidden />}
            {eyebrow}
          </p>
          <h2 className="mt-4 text-3xl font-medium leading-tight text-navy md:text-4xl">{title}</h2>
          <span className="gold-rule mt-6" />
          <p className="mt-6 text-lg leading-relaxed text-foreground/75">{body}</p>
          {slug && cta && (
            <Link
              to="/divisions/$slug"
              params={{ slug }}
              className="mt-8 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy hover:text-gold"
            >
              {cta} <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
