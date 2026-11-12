import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { pick } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { siteBasicsQuery } from "@/lib/queries";
import { Logo } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useNavItems } from "./SiteHeader";

export function SiteFooter() {
  const { t, lang } = useI18n();
  const items = useNavItems();
  const { data } = useSuspenseQuery(siteBasicsQuery);
  const s = (key: string) => data.settings[key]?.[lang] ?? "";
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy text-ivory">
      <div className="container-page grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr_1.4fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-ivory/70">{t.footer.about}</p>
          <div className="mt-6">
            <LanguageSwitcher tone="light" />
          </div>
        </div>

        <div>
          <h2 className="eyebrow">{t.footer.navigation}</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {items.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-ivory/75 transition-colors hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/submit-proposal" className="text-gold transition-colors hover:text-ivory">
                {t.nav.submit}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="eyebrow">{t.footer.divisions}</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {data.divisions.map((d) => (
              <li key={d.id}>
                <Link
                  to="/divisions/$slug"
                  params={{ slug: d.slug }}
                  className="text-ivory/75 transition-colors hover:text-gold"
                >
                  {pick(d, "name", lang)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="eyebrow">{t.footer.legal}</h2>
          <div className="mt-5 space-y-2 text-sm leading-relaxed text-ivory/70">
            <p>{t.footer.tradingName}</p>
            <p>
              {s("legal_name")} · {t.about.companyNumber} {s("company_number")}
            </p>
            <p>{t.footer.registered}</p>
            <p>{s("registered_office")}</p>
          </div>
        </div>
      </div>
      <div className="border-t border-ivory/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-ivory/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {s("legal_name") || "Jerry Trading Group Ltd."} — {t.footer.rights}
          </p>
          <p>{s("website").replace(/^https?:\/\//, "")}</p>
        </div>
      </div>
    </footer>
  );
}
