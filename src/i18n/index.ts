import { en, type Dictionary } from "./en";
import { fr } from "./fr";

export const LANGS = ["en", "fr"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "jg_lang";

export const dictionaries: Record<Lang, Dictionary> = { en, fr };
export type { Dictionary };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "fr";
}

/** Replace {placeholders} in a translated string. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

/** Pick the localized column of a bilingual database row, e.g. pick(row, "name", "fr") -> row.name_fr. */
export function pick<T extends Record<string, unknown>>(row: T, field: string, lang: Lang): string {
  const value = row[`${field}_${lang}`] ?? row[`${field}_en`];
  return typeof value === "string" ? value : "";
}

/** Reads the language from the root route's loader data inside a route head(). */
export function langFromMatches(matches: ReadonlyArray<{ loaderData?: unknown }>): Lang {
  const data = matches[0]?.loaderData as { lang?: unknown } | undefined;
  return isLang(data?.lang) ? data.lang : DEFAULT_LANG;
}

export function pageMeta(title: string, description: string) {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}
