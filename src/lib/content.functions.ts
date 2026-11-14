import { createServerFn } from "@tanstack/react-start";

export type Division = {
  id: string;
  slug: string;
  sort_order: number;
  name_en: string;
  name_fr: string;
  tagline_en: string;
  tagline_fr: string;
  summary_en: string;
  summary_fr: string;
  description_en: string;
  description_fr: string;
  domains_en: string[];
  domains_fr: string[];
};

export type SiteSettings = Record<string, { en: string; fr: string }>;

/** Divisions and institutional settings, shared by every page (header, footer, divisions). */
export const getSiteBasics = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicDb } = await import("./public-db.server");
  const db = getPublicDb();
  const [divisions, settings] = await Promise.all([
    db
      .from("divisions")
      .select(
        "id, slug, sort_order, name_en, name_fr, tagline_en, tagline_fr, summary_en, summary_fr, description_en, description_fr, domains_en, domains_fr",
      )
      .order("sort_order"),
    db.from("site_settings").select("key, value_en, value_fr"),
  ]);
  if (divisions.error) throw new Error(divisions.error.message);
  if (settings.error) throw new Error(settings.error.message);
  const map: SiteSettings = {};
  for (const row of settings.data) map[row.key] = { en: row.value_en, fr: row.value_fr };
  return { divisions: divisions.data as Division[], settings: map };
});

export const getPresence = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicDb } = await import("./public-db.server");
  const { data, error } = await getPublicDb()
    .from("presence_locations")
    .select("id, region, country_code, city, presence_type, note_en, note_fr, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);

  // Qatar is a confirmed group presence but is not yet included in the published
  // locations table. Keep it visible until the managed content is updated there.
  const hasQatar = data.some((location) => location.country_code === "QA");
  return hasQatar
    ? data
    : [
        ...data,
        {
          id: "local-presence-qatar",
          region: "asia",
          country_code: "QA",
          city: null,
          presence_type: null,
          note_en: "",
          note_fr: "",
          sort_order: 5,
        },
      ].sort((a, b) => a.sort_order - b.sort_order);
});

export const getLeadership = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicDb } = await import("./public-db.server");
  const { data, error } = await getPublicDb()
    .from("leadership_members")
    .select(
      "id, name_en, name_fr, role_en, role_fr, bio_en, bio_fr, expertise_en, expertise_fr, portrait_url, sort_order",
    )
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
});

export const getProposalCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicDb } = await import("./public-db.server");
  const { data, error } = await getPublicDb()
    .from("proposal_categories")
    .select("id, slug, sort_order, name_en, name_fr, description_en, description_fr, division_id, extra_fields")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
});
