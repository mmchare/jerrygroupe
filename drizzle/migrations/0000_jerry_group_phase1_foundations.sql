
-- =========================================================
-- Shared helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- Divisions (public content, bilingual)
-- =========================================================
CREATE TABLE public.divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  name_en text NOT NULL,
  name_fr text NOT NULL,
  tagline_en text NOT NULL DEFAULT '',
  tagline_fr text NOT NULL DEFAULT '',
  summary_en text NOT NULL DEFAULT '',
  summary_fr text NOT NULL DEFAULT '',
  description_en text NOT NULL DEFAULT '',
  description_fr text NOT NULL DEFAULT '',
  domains_en text[] NOT NULL DEFAULT '{}',
  domains_fr text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.divisions TO anon, authenticated;
GRANT ALL ON public.divisions TO service_role;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published divisions are public" ON public.divisions
  FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE TRIGGER divisions_touch BEFORE UPDATE ON public.divisions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Proposal categories (configurable dynamic fields)
-- =========================================================
CREATE TABLE public.proposal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  name_en text NOT NULL,
  name_fr text NOT NULL,
  description_en text NOT NULL DEFAULT '',
  description_fr text NOT NULL DEFAULT '',
  division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL,
  extra_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_categories_division_idx ON public.proposal_categories(division_id);
GRANT SELECT ON public.proposal_categories TO anon, authenticated;
GRANT ALL ON public.proposal_categories TO service_role;
ALTER TABLE public.proposal_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active categories are public" ON public.proposal_categories
  FOR SELECT TO anon, authenticated USING (is_active);
CREATE TRIGGER proposal_categories_touch BEFORE UPDATE ON public.proposal_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Global presence
-- =========================================================
CREATE TABLE public.presence_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL CHECK (region IN ('africa','europe','americas','asia','oceania')),
  country_code char(2) NOT NULL,
  city text,
  presence_type text CHECK (presence_type IN ('headquarters','office','representation','partner','project','operational')),
  note_en text NOT NULL DEFAULT '',
  note_fr text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.presence_locations TO anon, authenticated;
GRANT ALL ON public.presence_locations TO service_role;
ALTER TABLE public.presence_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published locations are public" ON public.presence_locations
  FOR SELECT TO anon, authenticated USING (is_published);
CREATE TRIGGER presence_locations_touch BEFORE UPDATE ON public.presence_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Leadership
-- =========================================================
CREATE TABLE public.leadership_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_fr text NOT NULL,
  role_en text NOT NULL,
  role_fr text NOT NULL,
  bio_en text,
  bio_fr text,
  expertise_en text,
  expertise_fr text,
  portrait_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leadership_members TO anon, authenticated;
GRANT ALL ON public.leadership_members TO service_role;
ALTER TABLE public.leadership_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published leadership is public" ON public.leadership_members
  FOR SELECT TO anon, authenticated USING (is_published);
CREATE TRIGGER leadership_members_touch BEFORE UPDATE ON public.leadership_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Site settings (institutional info, declaration, limits)
-- =========================================================
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value_en text NOT NULL DEFAULT '',
  value_fr text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public settings are readable" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (is_public);
CREATE TRIGGER site_settings_touch BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Proposals (private: only server code may read or write)
-- =========================================================
CREATE TYPE public.proposal_status AS ENUM (
  'received','under_review','additional_info_required','under_negotiation',
  'approved_in_principle','approved','rejected','purchase_order_issued','completed','archived'
);

CREATE TABLE public.reference_counters (
  scope text NOT NULL,
  year int NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, year)
);
GRANT ALL ON public.reference_counters TO service_role;
ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_proposal_reference()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  y int := extract(year FROM (now() AT TIME ZONE 'UTC'))::int;
  n bigint;
BEGIN
  INSERT INTO public.reference_counters(scope, year, last_value)
  VALUES ('proposal', y, 1)
  ON CONFLICT (scope, year) DO UPDATE SET last_value = public.reference_counters.last_value + 1
  RETURNING last_value INTO n;
  RETURN 'JG-PRP-' || y::text || '-' || lpad(n::text, 6, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_proposal_reference() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_proposal_reference() TO service_role;

CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  client_submission_id uuid NOT NULL UNIQUE,
  proposer_type text NOT NULL CHECK (proposer_type IN ('individual','company','cooperative','other')),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 150),
  company_name text CHECK (company_name IS NULL OR char_length(company_name) <= 200),
  country_code char(2) NOT NULL,
  city text NOT NULL CHECK (char_length(city) <= 120),
  email text NOT NULL CHECK (char_length(email) <= 255),
  whatsapp_e164 text NOT NULL CHECK (whatsapp_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  preferred_language text NOT NULL CHECK (preferred_language IN ('en','fr')),
  category_id uuid NOT NULL REFERENCES public.proposal_categories(id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 5000),
  origin_country_code char(2),
  quantity numeric CHECK (quantity IS NULL OR quantity >= 0),
  unit text,
  asking_price numeric CHECK (asking_price IS NULL OR asking_price >= 0),
  currency char(3),
  product_condition text,
  availability text,
  delivery_location text CHECK (delivery_location IS NULL OR char_length(delivery_location) <= 200),
  additional_info text CHECK (additional_info IS NULL OR char_length(additional_info) <= 3000),
  extra_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission_language text NOT NULL CHECK (submission_language IN ('en','fr')),
  status public.proposal_status NOT NULL DEFAULT 'received',
  declaration_accepted_at timestamptz NOT NULL,
  ip_hash text,
  user_agent text,
  acknowledgement_status text NOT NULL DEFAULT 'not_configured'
    CHECK (acknowledgement_status IN ('not_configured','pending','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposals_category_idx ON public.proposals(category_id);
CREATE INDEX proposals_status_idx ON public.proposals(status);
CREATE INDEX proposals_created_idx ON public.proposals(created_at DESC);
CREATE INDEX proposals_email_idx ON public.proposals(lower(email));
CREATE INDEX proposals_ip_idx ON public.proposals(ip_hash, created_at);
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER proposals_touch BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.proposals_assign_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.reference := public.next_proposal_reference();
  RETURN NEW;
END;
$$;
CREATE TRIGGER proposals_reference BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_assign_reference();

CREATE TABLE public.proposal_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_attachments_proposal_idx ON public.proposal_attachments(proposal_id);
GRANT ALL ON public.proposal_attachments TO service_role;
ALTER TABLE public.proposal_attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.proposal_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  status public.proposal_status NOT NULL,
  changed_by uuid,
  internal_note text,
  supplier_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_status_history_proposal_idx ON public.proposal_status_history(proposal_id, created_at);
GRANT ALL ON public.proposal_status_history TO service_role;
ALTER TABLE public.proposal_status_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.proposals_log_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.proposal_status_history(proposal_id, status)
    VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proposals_status_history AFTER INSERT OR UPDATE OF status ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposals_log_status();

-- =========================================================
-- Seed: divisions
-- =========================================================
INSERT INTO public.divisions (slug, sort_order, name_en, name_fr, tagline_en, tagline_fr, summary_en, summary_fr, description_en, description_fr, domains_en, domains_fr) VALUES
('medical-marine-sciences', 1, 'JERRY Medical & Marine Sciences', 'JERRY Medical & Marine Sciences',
 'Medicine, marine products and the sciences of the sea.',
 'Médecine, produits marins et sciences de la mer.',
 'The division bringing together the group’s activities in medicine, marine products — including sea cucumbers — and marine sciences.',
 'La division qui réunit les activités du groupe dans la médecine, les produits marins — dont les concombres de mer — et les sciences marines.',
 'JERRY Medical & Marine Sciences is the internal department of JERRY GROUP dedicated to medicine, marine products and marine science activities.

It is the group’s point of contact for producers, fishermen, cooperatives, suppliers and scientific partners who wish to present a product or an opportunity in these fields, including the supply of sea cucumbers. Every proposal is reviewed centrally by the group before any commitment is made.',
 'JERRY Medical & Marine Sciences est le département interne de JERRY GROUP consacré à la médecine, aux produits marins et aux activités scientifiques liées à la mer.

Il constitue l’interlocuteur du groupe pour les producteurs, pêcheurs, coopératives, fournisseurs et partenaires scientifiques souhaitant présenter un produit ou une opportunité dans ces domaines, notamment l’approvisionnement en concombres de mer. Chaque proposition est examinée de manière centralisée par le groupe avant tout engagement.',
 ARRAY['Medicine','Marine products','Sea cucumbers','Marine sciences and activities'],
 ARRAY['Médecine','Produits marins','Concombres de mer','Sciences et activités marines']),
('energy-natural-resources', 2, 'JERRY Energy & Natural Resources', 'JERRY Energy & Natural Resources',
 'Petroleum, gold and strategic natural resources.',
 'Pétrole, or et ressources naturelles stratégiques.',
 'The division covering petroleum, gold, natural resources and commodity-related opportunities.',
 'La division couvrant le pétrole, l’or, les ressources naturelles et les opportunités liées aux matières premières.',
 'JERRY Energy & Natural Resources is the internal department of JERRY GROUP dedicated to petroleum, gold, natural resources and commodity-related opportunities.

The division examines proposals from producers, suppliers and intermediaries worldwide. Each opportunity is assessed centrally, with the documentation and verifications appropriate to the sector.',
 'JERRY Energy & Natural Resources est le département interne de JERRY GROUP consacré au pétrole, à l’or, aux ressources naturelles et aux opportunités liées aux matières premières.

La division examine les propositions de producteurs, fournisseurs et intermédiaires du monde entier. Chaque opportunité fait l’objet d’une évaluation centralisée, accompagnée de la documentation et des vérifications propres au secteur.',
 ARRAY['Petroleum','Gold','Natural resources','Commodity opportunities'],
 ARRAY['Pétrole','Or','Ressources naturelles','Opportunités liées aux matières premières']),
('art-heritage', 3, 'JERRY Art & Heritage', 'JERRY Art & Heritage',
 'Ancient art, antiquities and cultural heritage.',
 'Art ancien, antiquités et patrimoine culturel.',
 'The division devoted to ancient art, antiquities, cultural heritage and artistic expertise.',
 'La division consacrée à l’art ancien, aux antiquités, au patrimoine culturel et à l’expertise artistique.',
 'JERRY Art & Heritage is the internal department of JERRY GROUP devoted to ancient art, antiquities, cultural heritage, and the expertise and enhancement of artworks.

The division welcomes proposals from collectors, artists and holders of works, with particular attention to declared provenance and supporting documentation.',
 'JERRY Art & Heritage est le département interne de JERRY GROUP consacré à l’art ancien, aux antiquités, au patrimoine culturel ainsi qu’à l’expertise et à la valorisation des œuvres.

La division accueille les propositions de collectionneurs, d’artistes et de détenteurs d’œuvres, avec une attention particulière portée à la provenance déclarée et aux justificatifs.',
 ARRAY['Ancient art','Antiquities','Cultural heritage','Artistic expertise and enhancement'],
 ARRAY['Art ancien','Antiquités','Patrimoine culturel','Expertise et valorisation artistique']),
('global-capital', 4, 'JERRY Global Capital', 'JERRY Global Capital',
 'Strategic and international investment.',
 'Investissements stratégiques et internationaux.',
 'The division handling investments, financial opportunities and strategic international projects.',
 'La division chargée des investissements, des opportunités financières et des projets stratégiques internationaux.',
 'JERRY Global Capital is the internal department of JERRY GROUP handling investments, financial opportunities, strategic projects and international investment.

Project holders, companies and partners may submit investment opportunities to the division, which reviews them centrally on behalf of the group.',
 'JERRY Global Capital est le département interne de JERRY GROUP chargé des investissements, des opportunités financières, des projets stratégiques et des investissements internationaux.

Porteurs de projets, entreprises et partenaires peuvent soumettre des opportunités d’investissement à la division, qui les examine de manière centralisée pour le compte du groupe.',
 ARRAY['Investments','Financial opportunities','Strategic projects','International investments'],
 ARRAY['Investissements','Opportunités financières','Projets stratégiques','Investissements internationaux']),
('philanthropy', 5, 'JERRY Philanthropy', 'JERRY Philanthropy',
 'Humanitarian action and social development.',
 'Action humanitaire et développement social.',
 'The division leading the group’s philanthropic, humanitarian, social development and community initiatives.',
 'La division qui porte les initiatives philanthropiques, humanitaires, sociales et communautaires du groupe.',
 'JERRY Philanthropy is the internal department of JERRY GROUP dedicated to philanthropy, humanitarian action, social development and community initiatives.

Organisations and project leaders may present philanthropic projects to the division for consideration by the group.',
 'JERRY Philanthropy est le département interne de JERRY GROUP consacré à la philanthropie, aux actions humanitaires, au développement social et aux initiatives communautaires.

Les organisations et porteurs de projets peuvent présenter des projets philanthropiques à la division, en vue de leur examen par le groupe.',
 ARRAY['Philanthropy','Humanitarian action','Social development','Community initiatives'],
 ARRAY['Philanthropie','Actions humanitaires','Développement social','Initiatives communautaires']),
('art-investments', 6, 'JERRY Art Investments', 'JERRY Art Investments',
 'Acquisition and enhancement of artworks.',
 'Acquisition et valorisation d’œuvres d’art.',
 'The division focused on art acquisition, art investment, collection enhancement and art market opportunities.',
 'La division dédiée à l’acquisition d’œuvres, à l’investissement artistique, à la valorisation des collections et aux opportunités du marché de l’art.',
 'JERRY Art Investments is the internal department of JERRY GROUP focused on the acquisition of artworks, art investment, the enhancement of collections and opportunities in the art market.

Collectors, galleries and intermediaries may submit works or collection opportunities, which are reviewed centrally by the group.',
 'JERRY Art Investments est le département interne de JERRY GROUP dédié à l’acquisition d’œuvres d’art, à l’investissement artistique, à la valorisation des collections et aux opportunités du marché de l’art.

Collectionneurs, galeries et intermédiaires peuvent soumettre des œuvres ou des opportunités de collection, examinées de manière centralisée par le groupe.',
 ARRAY['Art acquisition','Art investment','Collection enhancement','Art market opportunities'],
 ARRAY['Acquisition d’œuvres d’art','Investissement artistique','Valorisation des collections','Opportunités du marché de l’art']);

-- =========================================================
-- Seed: proposal categories with configurable extra fields
-- =========================================================
INSERT INTO public.proposal_categories (slug, sort_order, name_en, name_fr, description_en, description_fr, division_id, extra_fields) VALUES
('artworks-collectibles', 1, 'Artworks & Collectibles', 'Œuvres d’art et objets de collection',
 'Paintings, sculptures, antiquities and collectible objects.', 'Peintures, sculptures, antiquités et objets de collection.',
 (SELECT id FROM public.divisions WHERE slug = 'art-heritage'),
 '[
  {"key":"work_type","type":"select","required":true,"label_en":"Type of work","label_fr":"Type d’œuvre","options":[
    {"value":"painting","label_en":"Painting","label_fr":"Peinture"},
    {"value":"sculpture","label_en":"Sculpture","label_fr":"Sculpture"},
    {"value":"drawing","label_en":"Drawing / work on paper","label_fr":"Dessin / œuvre sur papier"},
    {"value":"antiquity","label_en":"Antiquity","label_fr":"Antiquité"},
    {"value":"object","label_en":"Collectible object","label_fr":"Objet de collection"},
    {"value":"other","label_en":"Other","label_fr":"Autre"}]},
  {"key":"artist","type":"text","label_en":"Artist, if known","label_fr":"Artiste, si connu"},
  {"key":"period","type":"text","label_en":"Estimated date or period","label_fr":"Date ou période estimée"},
  {"key":"dimensions","type":"text","label_en":"Dimensions","label_fr":"Dimensions"},
  {"key":"technique","type":"text","label_en":"Technique / medium","label_fr":"Technique"},
  {"key":"provenance","type":"textarea","label_en":"Declared provenance","label_fr":"Provenance déclarée"},
  {"key":"documents_available","type":"textarea","label_en":"Documents available (certificates, expert reports…)","label_fr":"Documents disponibles (certificats, expertises…)"}
 ]'::jsonb),
('marine-products', 2, 'Marine Products', 'Produits marins',
 'Sea cucumbers and other marine products.', 'Concombres de mer et autres produits marins.',
 (SELECT id FROM public.divisions WHERE slug = 'medical-marine-sciences'),
 '[
  {"key":"species","type":"text","label_en":"Species, if known","label_fr":"Espèce, si connue"},
  {"key":"product_state","type":"select","required":true,"label_en":"Product state","label_fr":"État du produit","options":[
    {"value":"fresh","label_en":"Fresh","label_fr":"Frais"},
    {"value":"dried","label_en":"Dried","label_fr":"Séché"},
    {"value":"processed","label_en":"Processed","label_fr":"Transformé"}]},
  {"key":"packaging","type":"text","label_en":"Packaging method","label_fr":"Méthode de conditionnement"},
  {"key":"traceability","type":"textarea","label_en":"Traceability information, if applicable","label_fr":"Informations de traçabilité, si applicables"},
  {"key":"documents_available","type":"textarea","label_en":"Documents available","label_fr":"Documents disponibles"}
 ]'::jsonb),
('petroleum-energy', 3, 'Petroleum & Energy', 'Pétrole et énergie',
 'Crude oil, refined products, gas and energy opportunities.', 'Pétrole brut, produits raffinés, gaz et opportunités énergétiques.',
 (SELECT id FROM public.divisions WHERE slug = 'energy-natural-resources'),
 '[
  {"key":"product_type","type":"select","required":true,"label_en":"Product type","label_fr":"Type de produit","options":[
    {"value":"crude","label_en":"Crude oil","label_fr":"Pétrole brut"},
    {"value":"refined","label_en":"Refined product","label_fr":"Produit raffiné"},
    {"value":"gas","label_en":"Gas","label_fr":"Gaz"},
    {"value":"other","label_en":"Other energy opportunity","label_fr":"Autre opportunité énergétique"}]},
  {"key":"specification","type":"textarea","label_en":"Specification / grade","label_fr":"Spécification / qualité"},
  {"key":"loading_location","type":"text","label_en":"Loading port or location","label_fr":"Port ou lieu de chargement"},
  {"key":"delivery_terms","type":"text","label_en":"Proposed delivery terms (e.g. Incoterms)","label_fr":"Conditions de livraison proposées (ex. Incoterms)"}
 ]'::jsonb),
('gold-natural-resources', 4, 'Gold & Natural Resources', 'Or et ressources naturelles',
 'Gold, precious metals, minerals and other natural resources.', 'Or, métaux précieux, minerais et autres ressources naturelles.',
 (SELECT id FROM public.divisions WHERE slug = 'energy-natural-resources'),
 '[
  {"key":"resource_type","type":"select","required":true,"label_en":"Resource type","label_fr":"Type de ressource","options":[
    {"value":"gold_bars","label_en":"Gold bars","label_fr":"Lingots d’or"},
    {"value":"gold_dore","label_en":"Gold doré","label_fr":"Or doré"},
    {"value":"gold_raw","label_en":"Nuggets / gold dust","label_fr":"Pépites / poudre d’or"},
    {"value":"mineral","label_en":"Other mineral","label_fr":"Autre minerai"},
    {"value":"other","label_en":"Other natural resource","label_fr":"Autre ressource naturelle"}]},
  {"key":"purity","type":"text","label_en":"Purity / grade","label_fr":"Pureté / teneur"},
  {"key":"assay_available","type":"select","label_en":"Assay report available","label_fr":"Rapport d’analyse disponible","options":[
    {"value":"yes","label_en":"Yes","label_fr":"Oui"},
    {"value":"no","label_en":"No","label_fr":"Non"}]},
  {"key":"export_documents","type":"textarea","label_en":"Export and origin documents available","label_fr":"Documents d’origine et d’exportation disponibles"}
 ]'::jsonb),
('investment-opportunities', 5, 'Investment Opportunities', 'Opportunités d’investissement',
 'Projects and companies seeking investment.', 'Projets et entreprises en recherche d’investissement.',
 (SELECT id FROM public.divisions WHERE slug = 'global-capital'),
 '[
  {"key":"sector","type":"text","required":true,"label_en":"Sector","label_fr":"Secteur"},
  {"key":"stage","type":"select","label_en":"Project stage","label_fr":"Stade du projet","options":[
    {"value":"concept","label_en":"Concept","label_fr":"Concept"},
    {"value":"early","label_en":"Early stage","label_fr":"Démarrage"},
    {"value":"growth","label_en":"Growth","label_fr":"Croissance"},
    {"value":"mature","label_en":"Established","label_fr":"Établi"}]},
  {"key":"amount_sought","type":"text","label_en":"Investment sought","label_fr":"Investissement recherché"},
  {"key":"horizon","type":"text","label_en":"Expected investment horizon","label_fr":"Horizon d’investissement envisagé"}
 ]'::jsonb),
('medical-scientific', 6, 'Medical & Scientific Opportunities', 'Opportunités médicales et scientifiques',
 'Medical products, research and scientific partnerships.', 'Produits médicaux, recherche et partenariats scientifiques.',
 (SELECT id FROM public.divisions WHERE slug = 'medical-marine-sciences'),
 '[
  {"key":"field","type":"text","required":true,"label_en":"Medical or scientific field","label_fr":"Domaine médical ou scientifique"},
  {"key":"regulatory_status","type":"textarea","label_en":"Regulatory status / approvals","label_fr":"Statut réglementaire / autorisations"}
 ]'::jsonb),
('philanthropic-projects', 7, 'Philanthropic Projects', 'Projets philanthropiques',
 'Humanitarian, social and community projects.', 'Projets humanitaires, sociaux et communautaires.',
 (SELECT id FROM public.divisions WHERE slug = 'philanthropy'),
 '[
  {"key":"beneficiaries","type":"textarea","required":true,"label_en":"Beneficiaries","label_fr":"Bénéficiaires"},
  {"key":"project_location","type":"text","label_en":"Project location","label_fr":"Lieu du projet"},
  {"key":"budget_estimate","type":"text","label_en":"Estimated budget","label_fr":"Budget estimé"}
 ]'::jsonb),
('other-business', 8, 'Other Business Proposals', 'Autres propositions commerciales',
 'Any other product, service or opportunity.', 'Tout autre produit, service ou opportunité.',
 NULL, '[]'::jsonb);

-- =========================================================
-- Seed: global presence (nature of presence left unspecified unless communicated)
-- =========================================================
INSERT INTO public.presence_locations (region, country_code, city, presence_type, note_en, note_fr, sort_order) VALUES
('europe','GB','London','headquarters','Global operational headquarters','Siège opérationnel mondial',1),
('africa','ZA',NULL,NULL,'','',1),
('africa','KE',NULL,NULL,'','',2),
('africa','EG',NULL,NULL,'','',3),
('americas','US',NULL,NULL,'','',1),
('americas','CA',NULL,NULL,'','',2),
('asia','KR',NULL,NULL,'','',1),
('asia','CN',NULL,NULL,'','',2),
('asia','JP',NULL,NULL,'','',3),
('asia','AE',NULL,NULL,'','',4),
('oceania','AU',NULL,NULL,'','',1),
('oceania','NZ',NULL,NULL,'','',2);

-- =========================================================
-- Seed: leadership (no biographies until officially provided)
-- =========================================================
INSERT INTO public.leadership_members (name_en, name_fr, role_en, role_fr, sort_order) VALUES
('Dr. Jerry A. Rey','Dr Jerry A. Rey','President of JERRY GROUP','Président de JERRY GROUP',1),
('Dr Aran Maree','Dr Aran Maree','Founding Member','Membre fondateur',2),
('Jonathan Imerman','Jonathan Imerman','Founding Member','Membre fondateur',3),
('Prince Althani of Qatar','Prince Althani du Qatar','Founding Member','Membre fondateur',4);

-- =========================================================
-- Seed: institutional settings
-- =========================================================
INSERT INTO public.site_settings (key, value_en, value_fr, is_public) VALUES
('legal_name','Jerry Trading Group Ltd.','Jerry Trading Group Ltd.',true),
('company_number','16874485','16874485',true),
('legal_form','Private Company Limited by Shares','Private Company Limited by Shares (société privée à responsabilité limitée par actions)',true),
('jurisdiction','England and Wales','Angleterre et pays de Galles',true),
('incorporation_date','25 November 2025','25 novembre 2025',true),
('registered_office','15 New Park Terrace, Pontypridd, Wales, CF37 1TH, United Kingdom','15 New Park Terrace, Pontypridd, pays de Galles, CF37 1TH, Royaume-Uni',true),
('operational_hq','London, United Kingdom','Londres, Royaume-Uni',true),
('president','Dr. Jerry A. Rey','Dr Jerry A. Rey',true),
('website','https://jerrygroupe.com','https://jerrygroupe.com',true),
('upload_max_mb','20','20',true),
('upload_max_files','10','10',true),
('submission_declaration',
 'I declare that the information provided in this proposal is accurate and complete to the best of my knowledge, and that I am entitled to submit it. I understand that submitting a proposal does not constitute any commitment by JERRY GROUP.',
 'Je déclare que les informations fournies dans cette proposition sont exactes et complètes à ma connaissance, et que je suis habilité(e) à la soumettre. Je comprends que la soumission d’une proposition n’engage en rien JERRY GROUP.',
 true);
