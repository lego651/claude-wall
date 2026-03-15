-- YouTube channels watchlist for daily news ingest
CREATE TABLE IF NOT EXISTS youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL UNIQUE,          -- YouTube channel ID (UCxxxxxxxx)
  channel_name TEXT NOT NULL,
  category TEXT NOT NULL,                   -- prop_firm_official | trading_educator | prop_firm_review | industry_news
  upload_playlist_id TEXT,                  -- cached from channels.list (UCx... → UUx...)
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_active ON youtube_channels(active);
CREATE INDEX IF NOT EXISTS idx_youtube_channels_category ON youtube_channels(category);
