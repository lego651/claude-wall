-- Migration: Topic grouping for Twitter review (S8 topic grouping)
-- 1) Add topic_title to industry_news_items (for grouping key)
-- 2) Create twitter_topic_groups table (industry groups with item_ids, like firm_daily_incidents)
-- Re-plan: documents/current_sprint/s8_twitter-topic-grouping-replan.md

-- 1. Add topic_title to industry_news_items (AI-generated short headline for grouping)
ALTER TABLE industry_news_items
  ADD COLUMN IF NOT EXISTS topic_title TEXT;

COMMENT ON COLUMN industry_news_items.topic_title IS 'Short AI headline (3-8 words) for grouping; tweets with same normalized topic_title form a topic group';

-- 2. Create twitter_topic_groups
CREATE TABLE IF NOT EXISTS twitter_topic_groups (
  id SERIAL PRIMARY KEY,

  topic_title TEXT NOT NULL,
  summary TEXT,

  item_type TEXT NOT NULL DEFAULT 'industry' CHECK (item_type IN ('industry', 'firm')),
  item_ids JSONB NOT NULL DEFAULT '[]',  -- array of industry_news_items.id (or firm_twitter_tweets.id for firm)
  source_type TEXT DEFAULT 'twitter',

  week_start DATE NOT NULL,
  year INT NOT NULL,
  week_number INT NOT NULL,

  firm_id TEXT REFERENCES firm_profiles(id) ON DELETE CASCADE,  -- NULL for industry

  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_twitter_topic_groups_week
  ON twitter_topic_groups (week_start, item_type);

CREATE INDEX idx_twitter_topic_groups_published
  ON twitter_topic_groups (published, week_start) WHERE published = true;

ALTER TABLE twitter_topic_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage twitter topic groups" ON twitter_topic_groups;
CREATE POLICY "Admins can manage twitter topic groups"
  ON twitter_topic_groups
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

DROP TRIGGER IF EXISTS update_twitter_topic_groups_updated_at ON twitter_topic_groups;
CREATE TRIGGER update_twitter_topic_groups_updated_at
  BEFORE UPDATE ON twitter_topic_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE twitter_topic_groups IS 'Grouped industry (or firm) tweets by topic for weekly-review; >=3 tweets per topic_title become one group';
