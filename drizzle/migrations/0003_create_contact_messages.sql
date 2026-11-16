CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_message_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 200),
  company_name text CHECK (company_name IS NULL OR char_length(company_name) <= 160),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','fr')),
  recipient text NOT NULL DEFAULT 'contact@jerrytradinggroup.com',
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX contact_messages_created_idx ON public.contact_messages (created_at DESC);
CREATE INDEX contact_messages_ip_idx ON public.contact_messages (ip_hash, created_at);
CREATE INDEX contact_messages_email_idx ON public.contact_messages (lower(email), created_at);