-- ============================================================================
-- ALPHA INTELLIGENCE ENGINE - DATABASE SCHEMA
-- TICKET-001: Database Schema Setup
-- Created: 2026-01-30
-- ============================================================================
-- Description: Schema for Trustpilot-based intelligence engine
-- Tables: trustpilot_reviews, firm_subscriptions, weekly_reports, weekly_incidents
-- ============================================================================

-- ============================================================================
-- 1. FIRMS TABLE (create if not exists, for reference integrity)
-- ============================================================================
-- Note: Firms table may already exist, so we'll ALTER if needed
-- This table will serve as the source of truth for database relationships

CREATE TABLE IF NOT EXISTS firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if they don't exist (safe for existing table)
DO $$
BEGIN
  -- addresses column may already exist with NOT NULL constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='firms' AND column_name='addresses') THEN
    ALTER TABLE firms ADD COLUMN addresses TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='firms' AND column_name='timezone') THEN
    ALTER TABLE firms ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='firms' AND column_name='website') THEN
    ALTER TABLE firms ADD COLUMN website TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='firms' AND column_name='logo_url') THEN
    ALTER TABLE firms ADD COLUMN logo_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='firms' AND column_name='trustpilot_url') THEN
    ALTER TABLE firms ADD COLUMN trustpilot_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='firms' AND column_name='twitter_handle') THEN
    ALTER TABLE firms ADD COLUMN twitter_handle TEXT;
  END IF;
END $$;

-- Enable RLS for firms
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read firms (public data)
DROP POLICY IF EXISTS "Anyone can view firms" ON firms;
CREATE POLICY "Anyone can view firms"
  ON firms
  FOR SELECT
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_firms_id ON firms(id);

-- ============================================================================
-- 2. TRUSTPILOT REVIEWS TABLE
-- ============================================================================
-- Stores scraped Trustpilot reviews with AI classification

CREATE TABLE IF NOT EXISTS trustpilot_reviews (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,

  -- Review data (from scraper)
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  review_text TEXT NOT NULL,
  reviewer_name TEXT,
  review_date DATE NOT NULL,
  trustpilot_url TEXT UNIQUE NOT NULL, -- Unique to prevent duplicates

  -- AI classification (populated after scraping)
  category TEXT, -- payout_issue, scam_warning, platform_issue, rule_violation, positive, neutral, noise
  severity TEXT CHECK (severity IN ('low', 'medium', 'high') OR severity IS NULL),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  ai_summary TEXT,

  -- Metadata
  classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT valid_category CHECK (
    category IN ('payout_issue', 'scam_warning', 'platform_issue', 'rule_violation', 'positive', 'neutral', 'noise')
    OR category IS NULL
  )
);

-- Enable RLS
ALTER TABLE trustpilot_reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read reviews (public data)
DROP POLICY IF EXISTS "Anyone can view reviews" ON trustpilot_reviews;
CREATE POLICY "Anyone can view reviews"
  ON trustpilot_reviews
  FOR SELECT
  USING (true);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_trustpilot_firm_date
  ON trustpilot_reviews(firm_id, review_date DESC);

CREATE INDEX IF NOT EXISTS idx_trustpilot_category
  ON trustpilot_reviews(firm_id, category, severity)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trustpilot_unclassified
  ON trustpilot_reviews(firm_id, created_at)
  WHERE classified_at IS NULL;

-- ============================================================================
-- 3. FIRM SUBSCRIPTIONS TABLE
-- ============================================================================
-- Tracks which users are subscribed to weekly reports for which firms

CREATE TABLE IF NOT EXISTS firm_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,

  -- Subscription settings
  email_enabled BOOLEAN DEFAULT true,

  -- Metadata
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ, -- Last time a report was sent

  -- Ensure one subscription per user per firm
  UNIQUE(user_id, firm_id)
);

-- Enable RLS
ALTER TABLE firm_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON firm_subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON firm_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own subscriptions
DROP POLICY IF EXISTS "Users can create own subscriptions" ON firm_subscriptions;
CREATE POLICY "Users can create own subscriptions"
  ON firm_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own subscriptions
DROP POLICY IF EXISTS "Users can update own subscriptions" ON firm_subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON firm_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own subscriptions
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON firm_subscriptions;
CREATE POLICY "Users can delete own subscriptions"
  ON firm_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON firm_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_firm
  ON firm_subscriptions(firm_id)
  WHERE email_enabled = true;

-- ============================================================================
-- 4. WEEKLY REPORTS TABLE
-- ============================================================================
-- Caches generated weekly reports (for performance and historical record)

CREATE TABLE IF NOT EXISTS weekly_reports (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  year INT NOT NULL CHECK (year >= 2024 AND year <= 2100),

  -- Report data (stored as JSON for flexibility)
  report_json JSONB NOT NULL,

  -- Metadata
  total_subscribers INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,

  generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one report per firm per week
  UNIQUE(firm_id, week_number, year)
);

-- Enable RLS
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read reports (will be used for public archive page)
DROP POLICY IF EXISTS "Anyone can view reports" ON weekly_reports;
CREATE POLICY "Anyone can view reports"
  ON weekly_reports
  FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reports_firm_week
  ON weekly_reports(firm_id, year DESC, week_number DESC);

CREATE INDEX IF NOT EXISTS idx_reports_recent
  ON weekly_reports(generated_at DESC);

-- ============================================================================
-- 5. WEEKLY INCIDENTS TABLE
-- ============================================================================
-- Aggregated incidents detected by AI from multiple reviews

CREATE TABLE IF NOT EXISTS weekly_incidents (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  year INT NOT NULL CHECK (year >= 2024 AND year <= 2100),

  -- Incident details
  incident_type TEXT NOT NULL CHECK (
    incident_type IN ('payout_issue', 'scam_warning', 'platform_issue', 'rule_violation', 'other')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL, -- AI-generated summary
  review_count INT DEFAULT 0, -- How many reviews mentioned this
  affected_users TEXT, -- Estimate (e.g., "~15-20")

  -- Source reviews (array of IDs)
  review_ids INT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE weekly_incidents ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view incidents
DROP POLICY IF EXISTS "Anyone can view incidents" ON weekly_incidents;
CREATE POLICY "Anyone can view incidents"
  ON weekly_incidents
  FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_incidents_firm_week
  ON weekly_incidents(firm_id, year DESC, week_number DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_severity
  ON weekly_incidents(severity, created_at DESC);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp for firms
DROP TRIGGER IF EXISTS update_firms_updated_at ON firms;
CREATE TRIGGER update_firms_updated_at
  BEFORE UPDATE ON firms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get week number from date
CREATE OR REPLACE FUNCTION get_week_number(input_date DATE)
RETURNS INT AS $$
BEGIN
  RETURN EXTRACT(WEEK FROM input_date)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get year from date
CREATE OR REPLACE FUNCTION get_year(input_date DATE)
RETURNS INT AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM input_date)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 7. SEED DATA - INSERT/UPDATE EXISTING FIRMS
-- ============================================================================
-- Migrate firms from data/propfirms.json to database
-- This uses UPSERT to handle both new inserts and updates to existing rows
-- Includes addresses from propfirms.json

INSERT INTO firms (id, name, timezone, addresses, website, logo_url) VALUES
  ('fundingpips', 'FundingPips', 'UTC', ARRAY['0x1e198Ad0608476EfA952De1cD8e574dB68df5f16'], 'https://fundingpips.com', '/logos/firms/fundingpips.jpeg'),
  ('instantfunding', 'InstantFunding', 'UTC', ARRAY['0xA3f21b162fA5a523e12590f2915cA418587Cf626'], 'https://instantfunding.com', '/logos/firms/instantfunding.jpeg'),
  ('blueguardian', 'Blue Guardian', 'UTC', ARRAY['0x68035843020B6c0CD94DD29c273FFF13c8e9A914'], 'https://blueguardian.com', '/logos/firms/blueguardian.jpeg'),
  ('the5ers', 'the5ers', 'UTC', ARRAY['0x349B0Ed1520eAE1472f57eaC77e390A1eCB0C677'], 'https://the5ers.com', '/logos/firms/the5ers.jpeg'),
  ('aquafunded', 'Aqua Funded', 'UTC', ARRAY['0x6F405a66cb4048fb05E72D74FCCcD5073697c469'], 'https://aquafunded.com', '/logos/firms/aquafunded.jpeg'),
  ('alphacapitalgroup', 'Alpha Capital Group', 'UTC', ARRAY['0xD172B9C227361FCf6151e802e1F09C084964BDCD'], 'https://alphacapitalgroup.com', '/logos/firms/alphacapitalgroup.jpeg'),
  ('fxify', 'FXIFY', 'UTC', ARRAY['0x36109F4D6804f391D830939c0C0e43EFc41a7486'], 'https://fxify.com', '/logos/firms/fxify.jpeg'),
  ('fundednext', 'Funded Next', 'UTC', ARRAY['0x2B9a16E8448091159CC2b2A205b11F2368D53CB6'], 'https://fundednext.com', '/logos/firms/fundednext.jpeg')
ON CONFLICT (id) DO UPDATE SET
  name = COALESCE(EXCLUDED.name, firms.name),
  timezone = COALESCE(EXCLUDED.timezone, firms.timezone),
  addresses = COALESCE(EXCLUDED.addresses, firms.addresses),
  website = COALESCE(EXCLUDED.website, firms.website),
  logo_url = COALESCE(EXCLUDED.logo_url, firms.logo_url),
  updated_at = NOW();

-- ============================================================================
-- 8. GRANTS (if needed for service role)
-- ============================================================================
-- Ensure service role can access tables for cron jobs

-- GRANT ALL ON firms TO service_role;
-- GRANT ALL ON trustpilot_reviews TO service_role;
-- GRANT ALL ON firm_subscriptions TO service_role;
-- GRANT ALL ON weekly_reports TO service_role;
-- GRANT ALL ON weekly_incidents TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Verification queries (uncomment to test):
-- SELECT * FROM firms;
-- SELECT COUNT(*) FROM trustpilot_reviews;
-- SELECT COUNT(*) FROM firm_subscriptions;
-- SELECT COUNT(*) FROM weekly_reports;
-- SELECT COUNT(*) FROM weekly_incidents;
