import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

import type { Lang } from "@/i18n";

export type CountryOption = { code: CountryCode; name: string; dial: string };

const cache = new Map<Lang, CountryOption[]>();

export function countryName(code: string, lang: Lang): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** All countries with localized names and international dialling codes, sorted by name. */
export function countryOptions(lang: Lang): CountryOption[] {
  const cached = cache.get(lang);
  if (cached) return cached;
  const names = new Intl.DisplayNames([lang], { type: "region" });
  const list = getCountries()
    .map((code) => ({ code, name: names.of(code) ?? code, dial: getCountryCallingCode(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
  cache.set(lang, list);
  return list;
}
