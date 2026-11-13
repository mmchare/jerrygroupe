import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { Check, Copy, FileText, Loader2, ShieldCheck, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format, pick } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { countryName, countryOptions } from "@/lib/countries";
import {
  ALLOWED_FILE_TYPES,
  AVAILABILITY,
  CONDITIONS,
  CURRENCIES,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_FILE_MB,
  PROPOSER_TYPES,
  UNITS,
  checkAttachment,
  parseExtraFields,
  proposalPayloadSchema,
  validateExtraAnswers,
} from "@/lib/proposal-rules";
import { createAttachmentUpload, submitProposal } from "@/lib/proposals.functions";
import { proposalCategoriesQuery, siteBasicsQuery } from "@/lib/queries";
import { uploadWithProgress } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { Field, inputClass } from "./fields";

type FormState = {
  proposerType: string;
  fullName: string;
  companyName: string;
  countryCode: string;
  city: string;
  email: string;
  whatsappCountry: string;
  whatsappNumber: string;
  preferredLanguage: "en" | "fr";
  categoryId: string;
  title: string;
  description: string;
  originCountryCode: string;
  quantity: string;
  unit: string;
  askingPrice: string;
  currency: string;
  productCondition: string;
  availability: string;
  deliveryLocation: string;
  additionalInfo: string;
  extraAnswers: Record<string, string>;
  website: string;
};

type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  path?: string;
};

type ErrorKey = keyof ReturnType<typeof useI18n>["t"]["errors"];

const STEP1 = ["proposerType", "fullName", "companyName", "countryCode", "city", "email", "whatsapp", "preferredLanguage"];
const STEP2 = [
  "categoryId", "title", "description", "originCountryCode", "quantity", "unit", "askingPrice",
  "currency", "productCondition", "availability", "deliveryLocation", "additionalInfo",
];

function toNumber(v: string): number | undefined | "invalid" {
  const s = v.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : "invalid";
}

export function ProposalWizard() {
  const { t, lang } = useI18n();
  const { data: categories } = useSuspenseQuery(proposalCategoriesQuery);
  const { data: basics } = useSuspenseQuery(siteBasicsQuery);
  const requestUpload = useServerFn(createAttachmentUpload);
  const sendProposal = useServerFn(submitProposal);

  const maxMb = Number(basics.settings["upload_max_mb"]?.en) || DEFAULT_MAX_FILE_MB;
  const maxFiles = Number(basics.settings["upload_max_files"]?.en) || DEFAULT_MAX_FILES;
  const declaration = basics.settings["submission_declaration"]?.[lang] ?? "";

  const submissionId = useRef<string | null>(null);
  const getSubmissionId = () => (submissionId.current ??= crypto.randomUUID());

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    proposerType: "individual", fullName: "", companyName: "", countryCode: "", city: "", email: "",
    whatsappCountry: "", whatsappNumber: "", preferredLanguage: lang, categoryId: "", title: "",
    description: "", originCountryCode: "", quantity: "", unit: "", askingPrice: "", currency: "",
    productCondition: "", availability: "", deliveryLocation: "", additionalInfo: "", extraAnswers: {}, website: "",
  });
  const [errors, setErrors] = useState<Record<string, ErrorKey>>({});
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string; createdAt: string; trackingToken: string | null } | null>(null);
  const [dragging, setDragging] = useState(false);

  const countries = useMemo(() => countryOptions(lang), [lang]);
  const category = categories.find((c) => c.id === form.categoryId);
  const extraFields = parseExtraFields(category?.extra_fields);
  const stepLabels = [t.proposal.steps.proposer, t.proposal.steps.details, t.proposal.steps.documents, t.proposal.steps.review];

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const { [key as string]: _removed, ...rest } = e;
      return rest;
    });
  };
  const setExtra = (key: string, value: string) => {
    setForm((f) => ({ ...f, extraAnswers: { ...f.extraAnswers, [key]: value } }));
    setErrors((e) => {
      const { [`extra.${key}`]: _removed, ...rest } = e;
      return rest;
    });
  };

  /** Builds the payload and collects errors (keys are field names). */
  function buildPayload() {
    const errs: Record<string, ErrorKey> = {};
    const phone = form.whatsappCountry
      ? parsePhoneNumberFromString(form.whatsappNumber, form.whatsappCountry as CountryCode)
      : undefined;
    const quantity = toNumber(form.quantity);
    const askingPrice = toNumber(form.askingPrice);
    if (quantity === "invalid") errs['quantity'] = "number";
    if (askingPrice === "invalid") errs['askingPrice'] = "number";
    const candidate = {
      clientSubmissionId: getSubmissionId(),
      submissionLanguage: lang,
      proposerType: form.proposerType,
      fullName: form.fullName,
      companyName: form.companyName,
      countryCode: form.countryCode,
      city: form.city,
      email: form.email,
      whatsapp: phone?.number ?? "",
      preferredLanguage: form.preferredLanguage,
      categoryId: form.categoryId,
      title: form.title,
      description: form.description,
      originCountryCode: form.originCountryCode || undefined,
      quantity: quantity === "invalid" ? undefined : quantity,
      unit: form.unit || undefined,
      askingPrice: askingPrice === "invalid" ? undefined : askingPrice,
      currency: form.currency || undefined,
      productCondition: form.productCondition || undefined,
      availability: form.availability || undefined,
      deliveryLocation: form.deliveryLocation,
      additionalInfo: form.additionalInfo,
      extraAnswers: form.extraAnswers,
      attachments: uploads
        .filter((u) => u.status === "done" && u.path)
        .map((u) => ({ path: u.path!, originalName: u.name })),
      declarationAccepted: accepted,
      website: form.website || undefined,
    };
    const parsed = proposalPayloadSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = (issue.message in t.errors ? issue.message : "invalid") as ErrorKey;
      }
    }
    const extra = validateExtraAnswers(extraFields, form.extraAnswers);
    for (const [k, code] of Object.entries(extra.errors)) errs[`extra.${k}`] = code;
    return { payload: parsed.success ? parsed.data : null, errs };
  }

  function validateStep(index: number) {
    const { errs } = buildPayload();
    const keys = index === 0 ? STEP1 : index === 1 ? STEP2 : [];
    const relevant = Object.fromEntries(
      Object.entries(errs).filter(([k]) => keys.includes(k) || (index === 1 && k.startsWith("extra."))),
    ) as Record<string, ErrorKey>;
    setErrors(relevant);
    if (Object.keys(relevant).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return false;
    }
    return true;
  }

  const goTo = (index: number) => {
    setStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = () => {
    if (step === 2 && uploads.some((u) => u.status === "uploading")) {
      toast.error(t.proposal.documents.waitUploads);
      return;
    }
    if (validateStep(step)) goTo(step + 1);
  };

  async function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const active = uploadsRef.current.filter((u) => u.status !== "error").length;
      const id = crypto.randomUUID();
      const base: UploadItem = { id, name: file.name, size: file.size, progress: 0, status: "uploading" };
      if (active >= maxFiles) {
        toast.error(t.errors.fileCount);
        return;
      }
      const problem = checkAttachment(file, maxMb);
      if (problem) {
        pushUpload({ ...base, status: "error", error: t.errors[problem] });
        continue;
      }
      pushUpload(base);
      try {
        const slot = await requestUpload({
          data: { clientSubmissionId: getSubmissionId(), fileName: file.name, size: file.size, mimeType: file.type },
        });
        if (!slot.ok) throw new Error(slot.error);
        await uploadWithProgress("proposal-attachments", slot.path, slot.token, file, (p) => patchUpload(id, { progress: p }));
        patchUpload(id, { status: "done", progress: 100, path: slot.path });
      } catch (err) {
        const code = err instanceof Error && err.message in t.errors ? (err.message as ErrorKey) : "uploadFailed";
        patchUpload(id, { status: "error", error: t.errors[code] });
      }
    }
  }
  const uploadsRef = useRef<UploadItem[]>([]);
  uploadsRef.current = uploads;
  const pushUpload = (u: UploadItem) => {
    uploadsRef.current = [...uploadsRef.current, u];
    setUploads(uploadsRef.current);
  };
  const patchUpload = (id: string, patch: Partial<UploadItem>) =>
    setUploads((list) => (uploadsRef.current = list.map((u) => (u.id === id ? { ...u, ...patch } : u))));

  async function submit() {
    const { payload, errs } = buildPayload();
    if (!payload) {
      setErrors(errs);
      const firstStep = Object.keys(errs).some((k) => STEP1.includes(k))
        ? 0
        : Object.keys(errs).some((k) => STEP2.includes(k) || k.startsWith("extra."))
          ? 1
          : 3;
      if (firstStep !== 3) goTo(firstStep);
      return;
    }
    setSubmitting(true);
    try {
      const res = await sendProposal({ data: payload });
      if (res.ok) {
        setResult({ reference: res.reference, createdAt: res.createdAt, trackingToken: res.trackingToken });
        goTo(4);
      } else {
        if (res.fields) {
          const mapped = Object.fromEntries(
            Object.entries(res.fields).map(([k, v]) => [k === "categoryId" ? k : `extra.${k}`, v as ErrorKey]),
          );
          setErrors(mapped);
          goTo(1);
        }
        toast.error(t.errors[res.error]);
      }
    } catch {
      toast.error(t.errors.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    submissionId.current = null;
    uploadsRef.current = [];
    setUploads([]);
    setAccepted(false);
    setResult(null);
    setForm((f) => ({ ...f, categoryId: "", title: "", description: "", quantity: "", askingPrice: "", extraAnswers: {}, additionalInfo: "" }));
    goTo(1);
  }

  const err = (key: string) => (errors[key] ? t.errors[errors[key]] : undefined);
  const inv = (key: string) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `${key}-error` : undefined });
  const opt = { optional: true, optionalLabel: t.common.optional };

  /* ---------------- Confirmation ---------------- */
  if (step === 4 && result) {
    const date = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeStyle: "short" }).format(new Date(result.createdAt));
    return (
      <div className="mx-auto max-w-2xl border border-gold/60 bg-card p-8 text-center shadow-card md:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-gold-soft text-gold">
          <Check className="size-7" />
        </span>
        <h2 className="mt-6 text-3xl text-navy">{t.proposal.confirmation.title}</h2>
        <p className="mt-3 text-muted-foreground">{t.proposal.confirmation.body}</p>
        <div className="mt-8 border border-border bg-background p-6">
          <p className="eyebrow">{t.proposal.confirmation.reference}</p>
          <p className="mt-3 font-display text-3xl tracking-wide text-navy" data-testid="proposal-reference">{result.reference}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t.proposal.confirmation.submittedAt} {date}
          </p>
          <Button
            variant="outline-navy"
            size="sm"
            className="mt-4"
            onClick={() => navigator.clipboard.writeText(result.reference).then(() => toast.success(t.proposal.confirmation.copied))}
          >
            <Copy /> {t.proposal.confirmation.copy}
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{t.proposal.confirmation.keep}</p>
        {result.trackingToken && (
          <div className="mt-8 border border-gold/50 bg-gold-soft/60 p-6 text-left">
            <p className="flex items-center gap-2 font-semibold text-navy">
              <ShieldCheck className="size-5 text-gold" aria-hidden /> {t.proposal.confirmation.trackTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t.proposal.confirmation.trackBody}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="sm">
                <Link to="/supplier/portal/$token" params={{ token: result.trackingToken }}>
                  {t.proposal.confirmation.trackOpen}
                </Link>
              </Button>
              <Button
                variant="outline-navy"
                size="sm"
                onClick={() =>
                  navigator.clipboard
                    .writeText(`${window.location.origin}/supplier/portal/${result.trackingToken}`)
                    .then(() => toast.success(t.proposal.confirmation.trackCopied))
                }
              >
                <Copy /> {t.proposal.confirmation.trackCopy}
              </Button>
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">{t.proposal.confirmation.trackFallback}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="gold" onClick={reset}>{t.proposal.confirmation.another}</Button>
          <Button asChild variant="outline-navy"><Link to="/">{t.proposal.confirmation.home}</Link></Button>
        </div>
      </div>
    );
  }

  const selectFrom = (id: keyof FormState, values: readonly string[], labels: Record<string, string>, optional = true) => (
    <Field id={id} label={(t.proposal.details as Record<string, string>)[id === "productCondition" ? "condition" : id] ?? id} error={err(id)} {...(optional ? opt : {})}>
      <select id={id} className={inputClass} value={form[id] as string} onChange={(e) => set(id, e.target.value as never)} {...inv(id)}>
        <option value="">{t.common.select}</option>
        {values.map((v) => <option key={v} value={v}>{labels[v] ?? v}</option>)}
      </select>
    </Field>
  );

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress */}
      <ol className="mb-10 grid grid-cols-4 gap-2" aria-label={format(t.proposal.stepOf, { current: step + 1, total: 4 })}>
        {stepLabels.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            <div className={cn("h-1 w-full transition-colors", i <= step ? "bg-gold" : "bg-border")} />
            <p className={cn("mt-2 text-[0.7rem] font-semibold uppercase tracking-wider", i === step ? "text-navy" : "text-muted-foreground")}>
              <span className="mr-1">{i + 1}.</span>
              <span className="hidden sm:inline">{label}</span>
            </p>
          </li>
        ))}
      </ol>

      <div className="border border-border bg-card p-6 shadow-card md:p-10">
        {/* Honeypot */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={(e) => set("website", e.target.value)} />

        {step === 0 && (
          <section className="space-y-6">
            <header>
              <h2 className="text-2xl text-navy">{t.proposal.proposer.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.proposal.proposer.intro}</p>
            </header>
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-navy">{t.proposal.proposer.type}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROPOSER_TYPES.map((type) => (
                  <label key={type} className={cn("cursor-pointer border px-3 py-3 text-center text-sm transition-colors", form.proposerType === type ? "border-gold bg-gold-soft font-semibold text-navy" : "border-input text-navy/80 hover:border-gold/60")}>
                    <input type="radio" name="proposerType" value={type} checked={form.proposerType === type} onChange={() => set("proposerType", type)} className="sr-only" />
                    {t.proposal.proposer.types[type]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="fullName" label={t.proposal.proposer.fullName} error={err("fullName")}>
                <input id="fullName" autoComplete="name" className={inputClass} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} {...inv("fullName")} />
              </Field>
              <Field id="companyName" label={t.proposal.proposer.companyName} error={err("companyName")} optional={form.proposerType === "individual"} optionalLabel={t.common.optional}>
                <input id="companyName" autoComplete="organization" className={inputClass} value={form.companyName} onChange={(e) => set("companyName", e.target.value)} {...inv("companyName")} />
              </Field>
              <Field id="countryCode" label={t.proposal.proposer.country} error={err("countryCode")}>
                <select id="countryCode" className={inputClass} value={form.countryCode} onChange={(e) => { set("countryCode", e.target.value); if (!form.whatsappCountry) set("whatsappCountry", e.target.value); }} {...inv("countryCode")}>
                  <option value="">{t.common.select}</option>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </Field>
              <Field id="city" label={t.proposal.proposer.city} error={err("city")}>
                <input id="city" autoComplete="address-level2" className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} {...inv("city")} />
              </Field>
              <Field id="email" label={t.proposal.proposer.email} error={err("email")}>
                <input id="email" type="email" inputMode="email" autoComplete="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} {...inv("email")} />
              </Field>
              <Field id="whatsapp" label={t.proposal.proposer.whatsapp} error={err("whatsapp")} hint={t.proposal.proposer.whatsappHint}>
                <div className="flex gap-2">
                  <select aria-label={t.proposal.proposer.dialCode} className={cn(inputClass, "w-32 shrink-0 px-2")} value={form.whatsappCountry} onChange={(e) => set("whatsappCountry", e.target.value)} {...inv("whatsapp")}>
                    <option value="">+ …</option>
                    {countries.map((c) => <option key={c.code} value={c.code}>{c.code} +{c.dial}</option>)}
                  </select>
                  <input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" className={inputClass} value={form.whatsappNumber} onChange={(e) => set("whatsappNumber" as keyof FormState, e.target.value as never)} onInput={() => setErrors(({ whatsapp: _w, ...rest }) => rest)} {...inv("whatsapp")} />
                </div>
              </Field>
            </div>
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-navy">{t.proposal.proposer.preferredLanguage}</legend>
              <div className="flex gap-2">
                {(["en", "fr"] as const).map((l) => (
                  <label key={l} lang={l} className={cn("cursor-pointer border px-5 py-2.5 text-sm", form.preferredLanguage === l ? "border-gold bg-gold-soft font-semibold text-navy" : "border-input text-navy/80")}>
                    <input type="radio" name="preferredLanguage" className="sr-only" checked={form.preferredLanguage === l} onChange={() => set("preferredLanguage", l)} />
                    {t.proposal.proposer.languages[l]}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-6">
            <header>
              <h2 className="text-2xl text-navy">{t.proposal.details.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.proposal.details.intro}</p>
            </header>
            <Field id="categoryId" label={t.proposal.details.category} error={err("categoryId")} hint={t.proposal.details.categoryHint}>
              <select id="categoryId" className={inputClass} value={form.categoryId} onChange={(e) => { set("categoryId", e.target.value); setForm((f) => ({ ...f, categoryId: e.target.value, extraAnswers: {} })); }} {...inv("categoryId")}>
                <option value="">{t.common.select}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{pick(c, "name", lang)}</option>)}
              </select>
            </Field>
            <Field id="title" label={t.proposal.details.name} error={err("title")}>
              <input id="title" className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} {...inv("title")} />
            </Field>
            <Field id="description" label={t.proposal.details.description} error={err("description")} hint={t.proposal.details.descriptionHint}>
              <textarea id="description" rows={5} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} {...inv("description")} />
            </Field>

            {extraFields.length > 0 && (
              <div className="space-y-6 border-l-2 border-gold bg-gold-soft/40 p-5">
                <h3 className="eyebrow">{t.proposal.details.specificTitle}</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {extraFields.map((f) => {
                    const id = `extra.${f.key}`;
                    const label = lang === "fr" ? f.label_fr : f.label_en;
                    return (
                      <Field key={f.key} id={id} label={label} error={err(id)} optional={!f.required} optionalLabel={t.common.optional} className={f.type === "textarea" ? "md:col-span-2" : undefined}>
                        {f.type === "select" ? (
                          <select id={id} className={inputClass} value={form.extraAnswers[f.key] ?? ""} onChange={(e) => setExtra(f.key, e.target.value)} {...inv(id)}>
                            <option value="">{t.common.select}</option>
                            {f.options?.map((o) => <option key={o.value} value={o.value}>{lang === "fr" ? o.label_fr : o.label_en}</option>)}
                          </select>
                        ) : f.type === "textarea" ? (
                          <textarea id={id} rows={3} className={inputClass} value={form.extraAnswers[f.key] ?? ""} onChange={(e) => setExtra(f.key, e.target.value)} {...inv(id)} />
                        ) : (
                          <input id={id} className={inputClass} value={form.extraAnswers[f.key] ?? ""} onChange={(e) => setExtra(f.key, e.target.value)} {...inv(id)} />
                        )}
                      </Field>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <Field id="originCountryCode" label={t.proposal.details.origin} error={err("originCountryCode")} {...opt}>
                <select id="originCountryCode" className={inputClass} value={form.originCountryCode} onChange={(e) => set("originCountryCode", e.target.value)}>
                  <option value="">{t.common.select}</option>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </Field>
              <Field id="deliveryLocation" label={t.proposal.details.deliveryLocation} error={err("deliveryLocation")} {...opt}>
                <input id="deliveryLocation" className={inputClass} value={form.deliveryLocation} onChange={(e) => set("deliveryLocation", e.target.value)} />
              </Field>
              <Field id="quantity" label={t.proposal.details.quantity} error={err("quantity")} {...opt}>
                <input id="quantity" inputMode="decimal" className={inputClass} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} {...inv("quantity")} />
              </Field>
              {selectFrom("unit", UNITS, t.proposal.options.units)}
              <Field id="askingPrice" label={t.proposal.details.price} error={err("askingPrice")} {...opt}>
                <input id="askingPrice" inputMode="decimal" className={inputClass} value={form.askingPrice} onChange={(e) => set("askingPrice", e.target.value)} {...inv("askingPrice")} />
              </Field>
              {selectFrom("currency", CURRENCIES, {})}
              {selectFrom("productCondition", CONDITIONS, t.proposal.options.conditions)}
              {selectFrom("availability", AVAILABILITY, t.proposal.options.availability)}
            </div>
            <Field id="additionalInfo" label={t.proposal.details.additional} error={err("additionalInfo")} {...opt}>
              <textarea id="additionalInfo" rows={3} className={inputClass} value={form.additionalInfo} onChange={(e) => set("additionalInfo", e.target.value)} />
            </Field>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6">
            <header>
              <h2 className="text-2xl text-navy">{t.proposal.documents.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.proposal.documents.intro}</p>
            </header>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
              className={cn("flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 text-center transition-colors", dragging ? "border-gold bg-gold-soft" : "border-input hover:border-gold/70")}
            >
              <Upload className="size-8 text-gold" aria-hidden />
              <span className="font-semibold text-navy">{t.proposal.documents.drop}</span>
              <span className="text-sm text-muted-foreground">{t.proposal.documents.dropHint}</span>
              <input
                type="file"
                multiple
                className="sr-only"
                accept={Object.keys(ALLOWED_FILE_TYPES).map((e) => `.${e}`).join(",")}
                onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {format(t.proposal.documents.rules, { count: maxFiles, size: maxMb, types: "PDF, JPG, PNG, WEBP, HEIC, DOC(X), XLS(X)" })}
            </p>
            {uploads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.proposal.documents.none}</p>
            ) : (
              <ul className="space-y-3">
                {uploads.map((u) => (
                  <li key={u.id} className="border border-border bg-background p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="size-5 shrink-0 text-navy/60" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy">{u.name}</p>
                        <p className={cn("text-xs", u.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                          {(u.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                          {u.status === "uploading" ? `${t.proposal.documents.uploading} ${u.progress}%` : u.status === "done" ? t.proposal.documents.uploaded : u.error ?? t.proposal.documents.failed}
                        </p>
                      </div>
                      {u.status === "uploading" ? (
                        <Loader2 className="size-4 animate-spin text-gold" />
                      ) : (
                        <button type="button" className="cursor-pointer p-1 text-muted-foreground hover:text-destructive" aria-label={`${t.proposal.documents.remove} ${u.name}`} onClick={() => setUploads((l) => (uploadsRef.current = l.filter((x) => x.id !== u.id)))}>
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    {u.status === "uploading" && <Progress value={u.progress} className="mt-3 h-1" />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-8">
            <header>
              <h2 className="text-2xl text-navy">{t.proposal.review.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.proposal.review.intro}</p>
            </header>
            <ReviewBlock title={t.proposal.steps.proposer} onEdit={() => goTo(0)} editLabel={t.common.edit} rows={[
              [t.proposal.proposer.type, t.proposal.proposer.types[form.proposerType as keyof typeof t.proposal.proposer.types]],
              [t.proposal.proposer.fullName, form.fullName],
              [t.proposal.proposer.companyName, form.companyName],
              [t.proposal.proposer.country, form.countryCode ? countryName(form.countryCode, lang) : ""],
              [t.proposal.proposer.city, form.city],
              [t.proposal.proposer.email, form.email],
              [t.proposal.proposer.whatsapp, form.whatsappCountry ? parsePhoneNumberFromString(form.whatsappNumber, form.whatsappCountry as CountryCode)?.formatInternational() ?? form.whatsappNumber : form.whatsappNumber],
              [t.proposal.proposer.preferredLanguage, t.proposal.proposer.languages[form.preferredLanguage]],
            ]} />
            <ReviewBlock title={t.proposal.steps.details} onEdit={() => goTo(1)} editLabel={t.common.edit} rows={[
              [t.proposal.details.category, category ? pick(category, "name", lang) : ""],
              [t.proposal.details.name, form.title],
              [t.proposal.details.description, form.description],
              ...extraFields.map((f): [string, string] => {
                const v = form.extraAnswers[f.key] ?? "";
                const o = f.options?.find((x) => x.value === v);
                return [lang === "fr" ? f.label_fr : f.label_en, o ? (lang === "fr" ? o.label_fr : o.label_en) : v];
              }),
              [t.proposal.details.origin, form.originCountryCode ? countryName(form.originCountryCode, lang) : ""],
              [t.proposal.details.quantity, [form.quantity, form.unit ? t.proposal.options.units[form.unit as keyof typeof t.proposal.options.units] : ""].filter(Boolean).join(" ")],
              [t.proposal.details.price, [form.askingPrice, form.currency].filter(Boolean).join(" ")],
              [t.proposal.details.condition, form.productCondition ? t.proposal.options.conditions[form.productCondition as keyof typeof t.proposal.options.conditions] : ""],
              [t.proposal.details.availability, form.availability ? t.proposal.options.availability[form.availability as keyof typeof t.proposal.options.availability] : ""],
              [t.proposal.details.deliveryLocation, form.deliveryLocation],
              [t.proposal.details.additional, form.additionalInfo],
            ]} />
            <ReviewBlock title={t.proposal.review.files} onEdit={() => goTo(2)} editLabel={t.common.edit} rows={
              uploads.filter((u) => u.status === "done").length
                ? uploads.filter((u) => u.status === "done").map((u, i): [string, string] => [`${i + 1}`, u.name])
                : [["", t.proposal.review.noFiles]]
            } />
            <div className="border border-gold/50 bg-gold-soft/40 p-5">
              <h3 className="eyebrow">{t.proposal.review.declarationTitle}</h3>
              <p className="mt-3 text-sm leading-relaxed text-navy">{declaration}</p>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-medium text-navy">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--gold)]" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setErrors(({ declarationAccepted: _d, ...rest }) => rest); }} aria-invalid={!!errors['declarationAccepted']} />
                {t.proposal.review.accept}
              </label>
              {errors['declarationAccepted'] && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{t.errors.declaration}</p>}
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button type="button" variant="outline-navy" size="xl" onClick={() => goTo(step - 1)}>{t.common.previous}</Button>
          ) : <span />}
          {step < 3 ? (
            <Button type="button" variant="default" size="xl" onClick={next}>{t.common.next}</Button>
          ) : (
            <Button type="button" variant="gold" size="xl" disabled={submitting} onClick={submit}>
              {submitting ? <><Loader2 className="animate-spin" /> {t.proposal.review.submitting}</> : t.proposal.review.submit}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewBlock({ title, rows, onEdit, editLabel }: { title: string; rows: [string, string][]; onEdit: () => void; editLabel: string }) {
  return (
    <div className="border border-border">
      <div className="flex items-center justify-between border-b border-border bg-secondary/60 px-5 py-3">
        <h3 className="font-sans text-sm font-semibold uppercase tracking-wider text-navy">{title}</h3>
        <button type="button" onClick={onEdit} className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-gold hover:text-navy">{editLabel}</button>
      </div>
      <dl className="divide-y divide-border">
        {rows.filter(([, v]) => v).map(([k, v], i) => (
          <div key={`${k}-${i}`} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[12rem_1fr]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="whitespace-pre-line break-words text-navy">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
