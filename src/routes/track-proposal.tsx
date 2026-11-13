import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Field, inputClass } from "@/components/proposal/fields";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { dictionaries, langFromMatches, pageMeta } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { verifyTracking } from "@/lib/tracking.functions";

export const Route = createFileRoute("/track-proposal")({
  head: ({ matches }) => {
    const t = dictionaries[langFromMatches(matches)];
    return { meta: pageMeta(t.meta.trackTitle, t.meta.trackDescription) };
  },
  component: TrackProposalPage,
});

function TrackProposalPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const verify = useServerFn(verifyTracking);
  const [reference, setReference] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reference.trim() || !contact.trim()) {
      setError(t.errors.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await verify({ data: { reference, contact, website } });
      if (res.ok) {
        await navigate({ to: "/supplier/portal/$token", params: { token: res.token } });
        return;
      }
      setError(
        res.error === "locked" ? t.errors.trackLocked : res.error === "invalid" ? t.errors.trackInvalid : t.errors.trackNotFound,
      );
    } catch {
      setError(t.common.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow={t.track.eyebrow} title={t.track.title} lead={t.track.lead} />
      <section className="bg-secondary/60 py-14 md:py-20">
        <div className="container-page grid gap-8 lg:grid-cols-[1fr_20rem]">
          <form onSubmit={onSubmit} noValidate className="border border-border bg-card p-6 shadow-card md:p-10">
            <h2 className="text-2xl text-navy">{t.track.formTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.track.formIntro}</p>
            <div className="mt-8 space-y-6">
              <Field id="reference" label={t.track.reference}>
                <input
                  id="reference"
                  name="reference"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  inputMode="text"
                  placeholder={t.track.referencePlaceholder}
                  className={`${inputClass} font-mono uppercase tracking-wide`}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={40}
                />
              </Field>
              <Field id="contact" label={t.track.contact} hint={t.track.contactHint}>
                <input
                  id="contact"
                  name="contact"
                  autoComplete="email"
                  spellCheck={false}
                  className={inputClass}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={255}
                />
              </Field>
              {/* Honeypot: hidden from people, filled in by bots. */}
              <div className="hidden" aria-hidden>
                <label htmlFor="website">Website</label>
                <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              {error && (
                <p role="alert" className="border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive" data-testid="track-error">
                  {error}
                </p>
              )}
              <Button type="submit" variant="gold" size="xl" disabled={busy} className="w-full sm:w-auto">
                {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} {busy ? t.track.verifying : t.track.submit}
              </Button>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-gold" aria-hidden /> {t.track.secureNote}
              </p>
            </div>
          </form>
          <aside className="space-y-6">
            <div className="border border-navy bg-navy p-6 text-ivory">
              <h2 className="text-xl text-ivory">{t.track.linkTitle}</h2>
              <p className="mt-2 text-sm text-ivory/75">{t.track.linkBody}</p>
            </div>
            <div className="border border-border bg-card p-6">
              <h2 className="text-xl text-navy">{t.track.noProposal}</h2>
              <Button asChild variant="outline-navy" className="mt-4">
                <Link to="/submit-proposal">{t.track.noProposalCta}</Link>
              </Button>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
