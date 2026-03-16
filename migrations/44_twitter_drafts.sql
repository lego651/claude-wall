-- Tweet draft queue for the daily YouTube picks bot.
-- One draft per day. Workflow: pending → approved → posted (or skipped/failed).
CREATE TABLE IF NOT EXISTS twitter_drafts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_date        DATE        NOT NULL UNIQUE,         -- UTC date this tweet is for
  tweet_text        TEXT        NOT NULL,                -- full tweet text (≤280 chars)
  template          CHAR(1)     NOT NULL,                -- 'A' (with creator ping) | 'B' (no ping)
  creator_handle    VARCHAR(100),                        -- @handle if Template A, null if B
  video_title       TEXT,                                -- title of rank-1 pick
  video_url         TEXT,                                -- youtube.com URL
  news_url          TEXT,                                -- /news page UTM link
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','posted','skipped','failed')),
  tweet_id          TEXT,                                -- set after successful post
  failure_reason    TEXT,                                -- set on status='failed'
  auto_approve      BOOLEAN     NOT NULL DEFAULT false,  -- skip manual review when true
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_twitter_drafts_date   ON twitter_drafts(draft_date DESC);
CREATE INDEX IF NOT EXISTS idx_twitter_drafts_status ON twitter_drafts(status);
