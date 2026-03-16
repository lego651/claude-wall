-- Add pool column to youtube_daily_candidates to store merged, channel, and keyword pools separately.
-- Each pool gets its own rank sequence (1-15 for merged, 1-10 for channel/keyword).

ALTER TABLE youtube_daily_candidates
  ADD COLUMN IF NOT EXISTS pool TEXT NOT NULL DEFAULT 'merged';

-- Drop the old (candidate_date, rank) unique constraint and replace with (candidate_date, rank, pool)
ALTER TABLE youtube_daily_candidates
  DROP CONSTRAINT IF EXISTS youtube_daily_candidates_candidate_date_rank_key;

ALTER TABLE youtube_daily_candidates
  ADD CONSTRAINT youtube_daily_candidates_candidate_date_rank_pool_key
  UNIQUE (candidate_date, rank, pool);
