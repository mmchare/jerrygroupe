import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, LogOut, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { format } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { endSupplierSession, type PortalData } from "@/lib/tracking.functions";
import { cn } from "@/lib/utils";
import { formatDate } from "./format";
import { StatusBadge } from "./StatusBadge";

export function PortalUnavailable({ reason }: { reason: "invalid" | "expired" }) {
  const { t } = useI18n();
  return (
    <section className="bg-secondary/60 py-20 md:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-lg border border-border bg-card p-8 text-center shadow-card md:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-gold-soft text-gold">
            <ShieldAlert className="size-7" aria-hidden />
          </span>
          <h1 className="mt-6 text-2xl text-navy md:text-3xl">
            {reason === "expired" ? t.portal.expiredTitle : t.portal.invalidTitle}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {reason === "expired" ? t.portal.expiredBody : t.portal.invalidBody}
          </p>
          <Button asChild variant="gold" size="xl" className="mt-8">
            <Link to="/track-proposal">{t.portal.verifyAgain}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function PortalShell({
  token,
  data,
  active,
  children,
}: {
  token: string;
  data: PortalData;
  active: "dossier" | "documents";
  children: ReactNode;
}) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const endSession = useServerFn(endSupplierSession);

  async function leave() {
    try {
      await endSession({ data: { token } });
    } finally {
      queryClient.removeQueries({ queryKey: ["supplier-portal"] });
      void navigate({ to: "/track-proposal" });
    }
  }

  const tab = (isActive: boolean) =>
    cn(
      "relative -mb-px border-b-2 px-1 pb-4 text-sm font-semibold transition-colors",
      isActive ? "border-gold text-ivory" : "border-transparent text-ivory/60 hover:text-ivory",
    );

  return (
    <>
      <section className="bg-navy text-ivory">
        <div className="container-page pt-12 md:pt-16">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">{t.portal.eyebrow}</p>
              <h1 className="mt-4 font-display text-3xl tracking-wide text-ivory md:text-4xl" data-testid="portal-reference">
                {data.reference}
              </h1>
              <p className="mt-2 max-w-xl text-ivory/75">{data.title}</p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <StatusBadge status={data.status} />
              <p className="flex items-center gap-1.5 text-xs text-ivory/60">
                <LockKeyhole className="size-3.5" aria-hidden />
                {data.access.purpose === "session"
                  ? format(t.portal.sessionUntil, { time: formatDate(data.access.expiresAt, lang, true) })
                  : t.portal.linkAccess}
              </p>
            </div>
          </div>
          <nav aria-label={t.portal.eyebrow} className="mt-10 flex items-end justify-between gap-6 border-b border-ivory/15">
            <div className="flex gap-8">
              <Link to="/supplier/portal/$token" params={{ token }} className={tab(active === "dossier")}>
                {t.portal.tabDossier}
              </Link>
              <Link to="/supplier/documents/$token" params={{ token }} className={tab(active === "documents")}>
                {t.portal.tabDocuments}
                {data.documents.some((d) => d.status === "published") && (
                  <span className="ml-2 rounded-full bg-gold px-1.5 py-0.5 text-[0.65rem] text-gold-foreground">
                    {data.documents.filter((d) => d.status === "published").length}
                  </span>
                )}
              </Link>
            </div>
            {data.access.purpose === "session" && (
              <button
                type="button"
                onClick={leave}
                className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ivory/70 transition-colors hover:text-gold"
              >
                <LogOut className="size-3.5" aria-hidden /> {t.portal.leave}
              </button>
            )}
          </nav>
        </div>
      </section>
      <section className="bg-secondary/60 py-10 md:py-14">
        <div className="container-page">{children}</div>
      </section>
    </>
  );
}

export function PortalSkeleton() {
  return (
    <>
      <div className="h-64 animate-pulse bg-navy" />
      <div className="container-page py-12">
        <div className="h-96 animate-pulse border border-border bg-card" />
      </div>
    </>
  );
}
