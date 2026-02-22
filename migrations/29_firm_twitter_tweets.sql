-- Migration: Create firm_twitter_tweets table (S8-TW-003b)
-- Description: Store firm-level tweets from Twitter/X with importance score for digest "top 3 per firm per week"
-- Sprint: S8 Twitter monitoring
-- Date: 2026-02-22

CREATE TABLE IF NOT EXISTS firm_twitter_tweets (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firm_profiles(id) ON DELETE CASCADE,

  -- Tweet identity and content
  tweet_id TEXT NOT NULL,
  url TEXT NOT NULL,
  text TEXT NOT NULL,
  author_username TEXT,
  tweeted_at DATE NOT NULL,

  -- AI processing (from batch categorizer)
  category TEXT,
  ai_summary TEXT,
  importance_score FLOAT CHECK (importance_score >= 0 AND importance_score <= 1),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (firm_id, url)
);

-- Index for digest: top 3 per firm per week by importance
CREATE INDEX idx_firm_twitter_tweets_firm_tweeted_at_importance
  ON firm_twitter_tweets (firm_id, tweeted_at DESC, importance_score DESC);

-- Index for dedupe lookups and recent tweets per firm
CREATE INDEX idx_firm_twitter_tweets_firm_tweeted_at
  ON firm_twitter_tweets (firm_id, tweeted_at DESC);

-- Enable Row Level Security (service role bypasses; admin policy for UI)
ALTER TABLE firm_twitter_tweets ENABLE ROW LEVEL SECURITY;

-- Admins can read (and manage if needed for S8-TW-007)
DROP POLICY IF EXISTS "Admins can manage firm twitter tweets" ON firm_twitter_tweets;
CREATE POLICY "Admins can manage firm twitter tweets"
  ON firm_twitter_tweets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Service role (cron) can insert without policy (bypasses RLS when using service key)
COMMENT ON TABLE firm_twitter_tweets IS 'Firm-level tweets from Twitter/X; digest selects top 3 per firm per week by importance_score';
COMMENT ON COLUMN firm_twitter_tweets.importance_score IS 'AI score 0-1 for digest ranking; ORDER BY importance_score DESC LIMIT 3 per firm per week';
