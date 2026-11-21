import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Mail, MessageCircle, Send } from "lucide-react";

import { Field, inputClass } from "@/components/proposal/fields";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { CONTACT_INBOX, contactFieldErrors, type ContactFieldError } from "@/lib/contact-rules";
import { sendContactMessage } from "@/lib/contact.functions";

const CONTACT_WHATSAPP = "+447482666769";
const CONTACT_WHATSAPP_URL = "https://wa.me/447482666769";
const empty = { fullName: "", email: "", companyName: "", subject: "", message: "", website: "" };
type FormState = typeof empty;

export function ContactForm() {
  const { t, lang } = useI18n();
  const f = t.contact.form;
  const send = useServerFn(sendContactMessage);
  const messageId = useRef<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, ContactFieldError>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => {
    setForm((s) => ({ ...s, [k]: e.target.value }));
    setErrors((s) => ({ ...s, [k]: undefined as never }));
    setFormError(null);
  };
  const err = (k: string) => (errors[k] ? f.errors[errors[k]] : undefined);
  const aria = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `contact-${k}-error` : undefined });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, clientMessageId: (messageId.current ??= crypto.randomUUID()), language: lang };
    const fieldErrors = contactFieldErrors(payload);
    if (fieldErrors) {
      setErrors(fieldErrors);
      return;
    }
    setStatus("sending");
    try {
      const res = await send({ data: payload });
      if (res.ok) {
        setStatus("sent");
        setForm(empty);
        messageId.current = null;
      } else {
        setStatus("idle");
        setFormError(res.error === "rateLimited" ? f.rateLimited : f.failed);
      }
    } catch {
      setStatus("idle");
      setFormError(f.failed);
    }
  }

  if (status === "sent") {
    return (
      <div className="border border-gold/60 bg-card p-8 text-center shadow-card md:p-12" role="status">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-gold-soft text-gold">
          <Check className="size-7" aria-hidden />
        </span>
        <h3 className="mt-6 text-2xl text-navy">{f.sentTitle}</h3>
        <p className="mt-3 text-muted-foreground">{f.sentBody}</p>
        <Button className="mt-8" variant="outline" onClick={() => setStatus("idle")}>
          {f.another}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="border border-gold/60 bg-card p-6 shadow-card md:p-10" aria-labelledby="contact-form-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{f.eyebrow}</p>
          <h2 id="contact-form-title" className="mt-3 text-3xl text-navy">{f.title}</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">{f.intro}</p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <a href={`mailto:${CONTACT_INBOX}`} className="inline-flex items-center gap-2 text-sm font-medium text-navy underline-offset-4 hover:underline">
            <Mail className="size-4 text-gold" aria-hidden />
            {CONTACT_INBOX}
          </a>
          <a
            href={CONTACT_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`WhatsApp ${CONTACT_WHATSAPP}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-navy underline-offset-4 hover:underline"
          >
            <MessageCircle className="size-4 text-gold" aria-hidden />
            WhatsApp&nbsp;{CONTACT_WHATSAPP}
          </a>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Field id="contact-fullName" label={f.fullName} error={err("fullName")}>
          <input id="contact-fullName" autoComplete="name" maxLength={120} className={inputClass} value={form.fullName} onChange={set("fullName")} {...aria("fullName")} />
        </Field>
        <Field id="contact-email" label={f.email} error={err("email")}>
          <input id="contact-email" type="email" autoComplete="email" maxLength={200} className={inputClass} value={form.email} onChange={set("email")} {...aria("email")} />
        </Field>
        <Field id="contact-companyName" label={f.company} optional optionalLabel={t.common.optional} error={err("companyName")}>
          <input id="contact-companyName" autoComplete="organization" maxLength={160} className={inputClass} value={form.companyName} onChange={set("companyName")} {...aria("companyName")} />
        </Field>
        <Field id="contact-subject" label={f.subject} error={err("subject")}>
          <input id="contact-subject" maxLength={160} className={inputClass} value={form.subject} onChange={set("subject")} {...aria("subject")} />
        </Field>
        <Field id="contact-message" label={f.message} error={err("message")} className="md:col-span-2">
          <textarea id="contact-message" rows={7} maxLength={5000} className={inputClass} value={form.message} onChange={set("message")} {...aria("message")} />
        </Field>
        <div className="hidden" aria-hidden>
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-muted-foreground">{f.privacy}</p>
        <Button type="submit" variant="gold" size="lg" disabled={status === "sending"}>
          {status === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          {status === "sending" ? f.sending : f.send}
        </Button>
      </div>
      {formError && (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">{formError}</p>
      )}
    </form>
  );
}
