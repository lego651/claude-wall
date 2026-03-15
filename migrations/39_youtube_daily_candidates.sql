-- Top-15 scored YouTube candidates per day (for debug/tuning)
CREATE TABLE IF NOT EXISTS youtube_daily_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_date DATE NOT NULL,
  rank SMALLINT NOT NULL,                   -- 1–15 by score
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL,
  score NUMERIC(6, 4) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'channel',   -- 'channel' | 'keyword'
  window_hours SMALLINT NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_youtube_daily_candidates_date
  ON youtube_daily_candidates(candidate_date DESC);
