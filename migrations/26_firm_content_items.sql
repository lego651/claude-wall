-- Migration: Create firm_content_items table
-- Description: Store firm-specific content (company news, rule changes, promotions) from multiple sources
-- Sprint: S8 (TICKET-S8-001)
-- Date: 2026-02-21

CREATE TABLE IF NOT EXISTS firm_content_items (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firm_profiles(id) ON DELETE CASCADE,

  -- Content metadata
  content_type TEXT NOT NULL CHECK (content_type IN (
    'company_news',
    'rule_change',
    'promotion',
    'other'
  )),

  -- Raw content
  title TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN (
    'manual_upload',
    'firm_email',
    'discord',
    'twitter',
    'reddit',
    'blog',
    'other'
  )),

  -- AI processing
  ai_summary TEXT,
  ai_category TEXT,
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_tags TEXT[],

  -- Attached media
  screenshot_url TEXT,
  attachment_urls TEXT[],

  -- Publication control
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  content_date DATE NOT NULL,

  -- Admin notes
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_firm_content_firm_date ON firm_content_items(firm_id, content_date DESC);
CREATE INDEX idx_firm_content_published ON firm_content_items(published, content_date DESC) WHERE published = true;
CREATE INDEX idx_firm_content_type ON firm_content_items(firm_id, content_type, content_date DESC);

-- Enable Row Level Security
ALTER TABLE firm_content_items ENABLE ROW LEVEL SECURITY;

-- Public can read published content
DROP POLICY IF EXISTS "Anyone can view published firm content" ON firm_content_items;
CREATE POLICY "Anyone can view published firm content"
  ON firm_content_items
  FOR SELECT
  USING (published = true);

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage firm content" ON firm_content_items;
CREATE POLICY "Admins can manage firm content"
  ON firm_content_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_firm_content_items_updated_at ON firm_content_items;
CREATE TRIGGER update_firm_content_items_updated_at
  BEFORE UPDATE ON firm_content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE firm_content_items IS 'Stores firm-specific content (news, rules, promotions) with AI categorization';
COMMENT ON COLUMN firm_content_items.content_type IS 'Manual categorization: company_news, rule_change, promotion, other';
COMMENT ON COLUMN firm_content_items.ai_category IS 'AI-generated category (may differ from content_type)';
COMMENT ON COLUMN firm_content_items.published IS 'Admin approval flag - only published content appears in digest';
