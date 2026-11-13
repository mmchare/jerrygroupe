
-- =========================================================
-- Supplier access tokens (secure individual links and verified sessions)
-- Only SHA-256 hashes are stored; the raw token lives only in the supplier's link.
-- =========================================================
CREATE TABLE public.supplier_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('link','session')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX supplier_access_tokens_proposal_idx ON public.supplier_access_tokens(proposal_id);
GRANT ALL ON public.supplier_access_tokens TO service_role;
ALTER TABLE public.supplier_access_tokens ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Tracking verification attempts (anti brute force)
-- =========================================================
CREATE TABLE public.tracking_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text,
  reference text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracking_attempts_ip_idx ON public.tracking_attempts(ip_hash, created_at);
CREATE INDEX tracking_attempts_reference_idx ON public.tracking_attempts(reference, created_at);
GRANT ALL ON public.tracking_attempts TO service_role;
ALTER TABLE public.tracking_attempts ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- Proposal messages (supplier replies and messages from JERRY GROUP)
-- =========================================================
CREATE TABLE public.proposal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('to_supplier','from_supplier')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  client_message_id uuid UNIQUE,
  author_id uuid,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_messages_proposal_idx ON public.proposal_messages(proposal_id, created_at);
GRANT ALL ON public.proposal_messages TO service_role;
ALTER TABLE public.proposal_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.proposal_attachments
  ADD COLUMN message_id uuid REFERENCES public.proposal_messages(id) ON DELETE CASCADE;
CREATE INDEX proposal_attachments_message_idx ON public.proposal_attachments(message_id);

-- =========================================================
-- Supplier Document Center
-- =========================================================
CREATE TYPE public.supplier_document_type AS ENUM (
  'purchase_order','contract','invoice','delivery_document','payment_receipt','amendment','other'
);

CREATE TABLE public.supplier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  -- Every version of the same document shares one group id.
  document_group_id uuid NOT NULL DEFAULT gen_random_uuid(),
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  doc_type public.supplier_document_type NOT NULL,
  reference text NOT NULL CHECK (char_length(reference) BETWEEN 1 AND 60),
  title_en text NOT NULL DEFAULT '',
  title_fr text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','revoked')),
  issue_date date NOT NULL DEFAULT current_date,
  published_at timestamptz,
  revoked_at timestamptz,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_group_id, version)
);
CREATE INDEX supplier_documents_proposal_idx ON public.supplier_documents(proposal_id, status);
GRANT ALL ON public.supplier_documents TO service_role;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER supplier_documents_touch BEFORE UPDATE ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- A published document is never silently overwritten: its file and identity are frozen,
-- and it may only move forward to superseded or revoked.
CREATE OR REPLACE FUNCTION public.supplier_documents_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF NEW.storage_path IS DISTINCT FROM OLD.storage_path
       OR NEW.file_name IS DISTINCT FROM OLD.file_name
       OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.document_group_id IS DISTINCT FROM OLD.document_group_id
       OR NEW.proposal_id IS DISTINCT FROM OLD.proposal_id
       OR NEW.reference IS DISTINCT FROM OLD.reference
       OR NEW.doc_type IS DISTINCT FROM OLD.doc_type THEN
      RAISE EXCEPTION 'A published document cannot be modified; publish a new version instead.';
    END IF;
    IF OLD.status = 'revoked' AND NEW.status <> 'revoked' THEN
      RAISE EXCEPTION 'A revoked document cannot be restored.';
    END IF;
    IF NEW.status = 'draft' THEN
      RAISE EXCEPTION 'A published document cannot return to draft.';
    END IF;
  END IF;
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  IF NEW.status = 'revoked' AND NEW.revoked_at IS NULL THEN
    NEW.revoked_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_documents_guard BEFORE UPDATE ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.supplier_documents_guard();

CREATE OR REPLACE FUNCTION public.supplier_documents_prepare_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_documents_prepare BEFORE INSERT ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.supplier_documents_prepare_insert();

-- Publishing a new version keeps older versions, marking them as superseded.
CREATE OR REPLACE FUNCTION public.supplier_documents_supersede()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    UPDATE public.supplier_documents
       SET status = 'superseded'
     WHERE document_group_id = NEW.document_group_id
       AND id <> NEW.id
       AND status = 'published'
       AND version < NEW.version;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_documents_supersede AFTER INSERT OR UPDATE OF status ON public.supplier_documents
  FOR EACH ROW EXECUTE FUNCTION public.supplier_documents_supersede();
