-- Migration: Create firm_email_senders table
-- Description: Replaces static sender→firm mapping in lib/gmail/firm-mapper.ts with DB-managed config
-- Phase 5 — Gmail ingest pipeline
-- Date: 2026-03-10

CREATE TABLE IF NOT EXISTS firm_email_senders (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firm_profiles(id) ON DELETE CASCADE,

  -- Exact email match (higher priority than domain)
  sender_email TEXT,
  -- Domain match fallback
  sender_domain TEXT,

  -- At least one must be set
  CONSTRAINT chk_firm_sender_has_value CHECK (
    sender_email IS NOT NULL OR sender_domain IS NOT NULL
  ),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique per email / per domain to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_senders_email
  ON firm_email_senders(sender_email) WHERE sender_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_firm_senders_domain
  ON firm_email_senders(sender_domain) WHERE sender_domain IS NOT NULL;

-- Enable RLS
ALTER TABLE firm_email_senders ENABLE ROW LEVEL SECURITY;

-- Admins can manage senders
DROP POLICY IF EXISTS "Admins can manage firm_email_senders" ON firm_email_senders;
CREATE POLICY "Admins can manage firm_email_senders"
  ON firm_email_senders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- service_role bypasses RLS (used by ingest pipeline)

COMMENT ON TABLE firm_email_senders IS 'Maps sender emails/domains to firm_id for Gmail ingest routing. Replaces static config in lib/gmail/firm-mapper.ts.';
COMMENT ON COLUMN firm_email_senders.sender_email IS 'Exact email address match (higher priority). Unique.';
COMMENT ON COLUMN firm_email_senders.sender_domain IS 'Domain-level match fallback. Unique.';

-- -----------------------------------------------------------------------
-- Seed: migrate static maps from lib/gmail/firm-mapper.ts
-- -----------------------------------------------------------------------

-- Full email overrides
INSERT INTO firm_email_senders (firm_id, sender_email) VALUES
  ('fundingpips', 'updates@fundingpips.com'),
  ('fundingpips', 'noreply@fundingpips.com'),
  ('fxify',       'hello@fxify.com'),
  ('fxify',       'support@fxify.com'),
  ('fundednext',  'hello@fundednext.com'),
  ('fundednext',  'support@fundednext.com')
ON CONFLICT DO NOTHING;

-- Domain-level mappings
INSERT INTO firm_email_senders (firm_id, sender_domain) VALUES
  ('fundingpips',       'fundingpips.com'),
  ('fxify',             'fxify.com'),
  ('fundednext',        'fundednext.com'),
  ('the5ers',           'the5ers.com'),
  ('instantfunding',    'instantfunding.com'),
  ('blueguardian',      'blueguardian.com'),
  ('aquafunded',        'aquafunded.com'),
  ('alphacapitalgroup', 'alphacapitalgroup.com'),
  ('ftmo',              'ftmo.com'),
  ('topstep',           'topstep.com'),
  ('apex',              'apextraderfunding.com'),
  ('apex',              'apex.com')
ON CONFLICT DO NOTHING;
