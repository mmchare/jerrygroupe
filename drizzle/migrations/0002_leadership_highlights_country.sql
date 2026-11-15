ALTER TABLE public.leadership_members ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.leadership_members ADD COLUMN IF NOT EXISTS highlights jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.leadership_members.highlights IS 'Key achievements: array of {value, label_en, label_fr}';