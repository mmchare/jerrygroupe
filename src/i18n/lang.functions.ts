import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";

import { DEFAULT_LANG, LANG_COOKIE, isLang, type Lang } from "./index";

/** Server-side language detection: saved cookie first, then the browser's Accept-Language. */
export const getServerLang = createServerFn({ method: "GET" }).handler(async (): Promise<Lang> => {
  const saved = getCookie(LANG_COOKIE);
  if (isLang(saved)) return saved;
  const accept = getRequestHeader("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return isLang(first) ? first : DEFAULT_LANG;
});
