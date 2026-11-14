import { dictionaries, pick, type Lang } from "@/i18n";
import { countryName } from "@/lib/countries";
import { getPublicDb } from "@/lib/public-db.server";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<Lang, { at: number; text: string }>();

/** Published site content, condensed into a reference sheet for the assistant. */
export async function getSiteKnowledge(lang: Lang): Promise<string> {
  const hit = cache.get(lang);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;

  const db = getPublicDb();
  const [divisions, settings, presence, leadership, categories] = await Promise.all([
    db
      .from("divisions")
      .select("slug, sort_order, name_en, name_fr, tagline_en, tagline_fr, summary_en, summary_fr, description_en, description_fr, domains_en, domains_fr")
      .order("sort_order"),
    db.from("site_settings").select("key, value_en, value_fr"),
    db.from("presence_locations").select("region, country_code, city, note_en, note_fr, sort_order").order("sort_order"),
    db.from("leadership_members").select("name_en, name_fr, role_en, role_fr, bio_en, bio_fr, expertise_en, expertise_fr, sort_order").order("sort_order"),
    db.from("proposal_categories").select("name_en, name_fr, description_en, description_fr, sort_order").order("sort_order"),
  ]);
  for (const r of [divisions, settings, presence, leadership, categories]) {
    if (r.error) throw new Error(r.error.message);
  }

  const t = dictionaries[lang];
  const lines: string[] = [];
  lines.push("## About the group", t.about.lead, t.about.body1, t.about.body2, t.about.legalIntro);
  lines.push(`- ${t.about.p1Title}: ${t.about.p1Body}`, `- ${t.about.p2Title}: ${t.about.p2Body}`, `- ${t.about.p3Title}: ${t.about.p3Body}`);

  lines.push("", "## Institutional details");
  for (const row of settings.data ?? []) {
    if (row.key === "upload_max_mb") continue;
    const value = lang === "fr" ? row.value_fr || row.value_en : row.value_en;
    if (value) lines.push(`- ${row.key.replace(/_/g, " ")}: ${value}`);
  }

  lines.push("", "## Divisions (internal departments of JERRY GROUP, not separate companies)", t.divisions.lead);
  for (const d of divisions.data ?? []) {
    const domains = (lang === "fr" ? d.domains_fr : d.domains_en) ?? [];
    lines.push(
      `### ${pick(d, "name", lang)} — page: /divisions/${d.slug}`,
      pick(d, "tagline", lang),
      pick(d, "summary", lang),
      pick(d, "description", lang),
      domains.length ? `${t.divisions.domains}: ${domains.join(", ")}` : "",
    );
  }

  lines.push("", "## Leadership (page: /leadership)");
  for (const m of leadership.data ?? []) {
    const expertise = (lang === "fr" ? m.expertise_fr : m.expertise_en) ?? [];
    lines.push(
      `- ${pick(m, "name", lang)} — ${pick(m, "role", lang)}${pick(m, "bio", lang) ? `. ${pick(m, "bio", lang)}` : ""}${expertise.length ? ` (${expertise.join(", ")})` : ""}`,
    );
  }

  const countries = new Set<string>();
  const presenceLines: string[] = [];
  for (const p of presence.data ?? []) {
    const name = countryName(p.country_code, lang);
    countries.add(p.country_code);
    presenceLines.push(`- ${name}${p.city ? ` (${p.city})` : ""} — ${p.region}${pick(p, "note", lang) ? `: ${pick(p, "note", lang)}` : ""}`);
  }
  if (!countries.has("QA")) presenceLines.push(`- ${countryName("QA", lang)} — asia`);
  lines.push("", "## Global presence (page: /global-presence)", ...presenceLines);

  lines.push("", "## Proposal categories accepted (submit at /submit-proposal, no account required)");
  for (const c of categories.data ?? []) {
    lines.push(`- ${pick(c, "name", lang)}${pick(c, "description", lang) ? `: ${pick(c, "description", lang)}` : ""}`);
  }
  lines.push(
    "",
    "## Proposal process",
    t.proposal.lead,
    "The form has five steps: proposer details, proposal details, documents, review, confirmation. Each submission receives a unique reference (format JG-PRP-YYYY-NNNNNN).",
    `${t.track.title} (/track-proposal): ${t.track.lead} ${t.track.formIntro}`,
    `Possible statuses: ${Object.values(t.statuses).join(", ")}.`,
    "",
    "## Site pages",
    "Home /, About /about, Leadership /leadership, Divisions /divisions, Global presence /global-presence, Contact /contact, Submit a proposal /submit-proposal, Track your proposal /track-proposal.",
  );

  const text = lines.filter((l) => l !== "").join("\n");
  cache.set(lang, { at: Date.now(), text });
  return text;
}
