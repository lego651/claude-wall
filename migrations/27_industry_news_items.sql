-- Migration: Create industry_news_items table
-- Description: Store industry-wide news (not firm-specific, or affects multiple firms)
-- Sprint: S8 (TICKET-S8-002)
-- Date: 2026-02-21

CREATE TABLE IF NOT EXISTS industry_news_items (
  id SERIAL PRIMARY KEY,

  -- Content metadata
  title TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN (
    'manual_upload',
    'news_website',
    'twitter',
    'reddit',
    'regulatory',
    'other'
  )),

  -- AI processing
  ai_summary TEXT,
  ai_category TEXT,
  ai_confidence FLOAT CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_tags TEXT[],

  -- Firm associations (if industry news mentions specific firms)
  mentioned_firm_ids TEXT[],

  -- Attached media
  screenshot_url TEXT,
  attachment_urls TEXT[],

  -- Publication control
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT NOW(),
  content_date DATE NOT NULL,

  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_industry_news_date ON industry_news_items(content_date DESC);
CREATE INDEX idx_industry_news_published ON industry_news_items(published, content_date DESC) WHERE published = true;
CREATE INDEX idx_industry_news_firms ON industry_news_items USING GIN(mentioned_firm_ids);

-- Enable Row Level Security
ALTER TABLE industry_news_items ENABLE ROW LEVEL SECURITY;

-- Public can read published content
DROP POLICY IF EXISTS "Anyone can view published industry news" ON industry_news_items;
CREATE POLICY "Anyone can view published industry news"
  ON industry_news_items
  FOR SELECT
  USING (published = true);

-- Admins can do everything
DROP POLICY IF EXISTS "Admins can manage industry news" ON industry_news_items;
CREATE POLICY "Admins can manage industry news"
  ON industry_news_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_industry_news_items_updated_at ON industry_news_items;
CREATE TRIGGER update_industry_news_items_updated_at
  BEFORE UPDATE ON industry_news_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE industry_news_items IS 'Industry-wide news affecting multiple firms or the prop trading industry';
COMMENT ON COLUMN industry_news_items.mentioned_firm_ids IS 'Array of firm IDs mentioned in the news (AI-extracted)';
COMMENT ON COLUMN industry_news_items.published IS 'Admin approval flag - only published content appears in digest';
