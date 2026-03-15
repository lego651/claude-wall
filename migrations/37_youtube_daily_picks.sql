-- Daily top-3 YouTube video picks (populated by cron at 07:00 UTC)
CREATE TABLE IF NOT EXISTS youtube_daily_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_date DATE NOT NULL,                  -- UTC date this pick is for
  rank SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 3),
  video_id TEXT NOT NULL,                   -- YouTube video ID
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  views BIGINT NOT NULL DEFAULT 0,
  likes BIGINT NOT NULL DEFAULT 0,
  comments BIGINT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL,
  score NUMERIC(6, 4) NOT NULL DEFAULT 0,   -- composite score (0–1)
  ai_summary TEXT,                          -- GPT-4o-mini blurb (~2 sentences)
  source TEXT NOT NULL DEFAULT 'channel',   -- 'channel' | 'keyword'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pick_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_youtube_daily_picks_date ON youtube_daily_picks(pick_date DESC);
