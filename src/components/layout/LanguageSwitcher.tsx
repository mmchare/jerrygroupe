import { useI18n } from "@/i18n/I18nProvider";
import { LANGS } from "@/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div role="group" aria-label={t.nav.language} className="inline-flex items-center text-xs font-semibold tracking-[0.16em]">
      {LANGS.map((code, i) => (
        <span key={code} className="inline-flex items-center">
          {i > 0 && <span aria-hidden className={cn("px-1.5", tone === "light" ? "text-ivory/30" : "text-border")}>|</span>}
          <button
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            lang={code}
            className={cn(
              "cursor-pointer px-1 py-1 uppercase transition-colors",
              lang === code
                ? "text-gold"
                : tone === "light"
                  ? "text-ivory/70 hover:text-ivory"
                  : "text-muted-foreground hover:text-navy",
            )}
          >
            {code}
          </button>
        </span>
      ))}
    </div>
  );
}
