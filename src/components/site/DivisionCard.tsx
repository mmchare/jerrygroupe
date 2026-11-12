import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { pick } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import type { Division } from "@/lib/content.functions";
import { divisionImage } from "@/lib/division-images";

export function DivisionCard({ division, index }: { division: Division; index: number }) {
  const { lang, t } = useI18n();
  const domains = lang === "fr" ? division.domains_fr : division.domains_en;
  return (
    <article className="group flex flex-col overflow-hidden border border-border bg-card shadow-card transition-shadow duration-500 hover:shadow-lg">
      <Link to="/divisions/$slug" params={{ slug: division.slug }} className="relative block aspect-[16/10] overflow-hidden" tabIndex={-1} aria-hidden>
        <img
          src={divisionImage(division.slug)}
          alt=""
          loading="lazy"
          width={1280}
          height={896}
          className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <span className="absolute left-0 top-0 bg-navy px-3 py-2 font-display text-sm text-gold">
          {String(index + 1).padStart(2, "0")}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-6 md:p-7">
        <h3 className="text-xl font-medium leading-snug text-navy">{pick(division, "name", lang)}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pick(division, "summary", lang)}</p>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label={t.divisions.domains}>
          {domains.slice(0, 4).map((d) => (
            <li key={d} className="border border-border px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-navy/70">
              {d}
            </li>
          ))}
        </ul>
        <Link
          to="/divisions/$slug"
          params={{ slug: division.slug }}
          className="mt-auto inline-flex items-center gap-2 pt-7 text-xs font-semibold uppercase tracking-[0.18em] text-navy transition-colors hover:text-gold"
        >
          {t.common.learnMore}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
