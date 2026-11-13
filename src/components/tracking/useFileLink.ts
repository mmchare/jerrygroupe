import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n } from "@/i18n/I18nProvider";
import { getDocumentLink } from "@/lib/tracking.functions";

/** Asks the server for a short-lived signed link, only at the moment the supplier clicks. */
export function useFileLink(token: string) {
  const { t } = useI18n();
  const getLink = useServerFn(getDocumentLink);
  const [busy, setBusy] = useState<string | null>(null);

  async function fetchLink(kind: "document" | "attachment", id: string, download: boolean) {
    setBusy(`${id}:${download ? "d" : "v"}`);
    try {
      const res = await getLink({ data: { token, kind, id, download } });
      if (res.ok) return res.url;
      toast.error(res.error === "expired" ? t.errors.linkExpired : res.error === "denied" ? t.errors.linkDenied : t.common.genericError);
      return null;
    } catch {
      toast.error(t.common.genericError);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function download(kind: "document" | "attachment", id: string) {
    const url = await fetchLink(kind, id, true);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return { fetchLink, download, busy };
}
