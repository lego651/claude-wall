-- Migration: Store industry tweets in firm_twitter_tweets (firm_id = 'industry')
-- Replaces industry_news_items for Twitter-sourced industry content; one tweets table for firm + industry.
-- See documents/spikes/twitter-industry-in-tweets-table.md

-- 1. Add sentinel firm profile so firm_id='industry' satisfies FK (addresses NOT NULL on firm_profiles)
INSERT INTO firm_profiles (id, name, addresses)
VALUES ('industry', 'Industry', ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, addresses = COALESCE(EXCLUDED.addresses, firm_profiles.addresses);

-- 2. Add topic_title and published columns to firm_twitter_tweets (used for industry rows)
ALTER TABLE firm_twitter_tweets
  ADD COLUMN IF NOT EXISTS topic_title TEXT,
  ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

COMMENT ON COLUMN firm_twitter_tweets.topic_title IS 'Short AI headline for grouping; used for industry tweets (firm_id=industry)';
COMMENT ON COLUMN firm_twitter_tweets.published IS 'For industry tweets (firm_id=industry): admin approval. NULL for firm tweets (not used).';

-- Index for topic grouping and digest: industry tweets by week
CREATE INDEX IF NOT EXISTS idx_firm_twitter_tweets_industry_published
  ON firm_twitter_tweets (firm_id, tweeted_at DESC)
  WHERE firm_id = 'industry';

CREATE INDEX IF NOT EXISTS idx_firm_twitter_tweets_industry_topic_title
  ON firm_twitter_tweets (firm_id, topic_title)
  WHERE firm_id = 'industry' AND topic_title IS NOT NULL;
