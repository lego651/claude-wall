-- Migration: Store trader monthly payout history in Supabase (replaces data/traders/*.json)
-- One row per (wallet_address, year_month). data JSONB holds full month blob (summary, dailyBuckets, transactions).
-- Written by daily GA and by backfill when user links wallet; read by API so new users see data immediately.

CREATE TABLE IF NOT EXISTS trader_payout_history (
  wallet_address TEXT NOT NULL,
  year_month TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (wallet_address, year_month)
);

CREATE INDEX IF NOT EXISTS idx_trader_payout_history_wallet ON trader_payout_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trader_payout_history_year_month ON trader_payout_history(year_month);

ALTER TABLE trader_payout_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view trader payout history"
  ON trader_payout_history
  FOR SELECT
  USING (true);

COMMENT ON TABLE trader_payout_history IS 'Monthly payout blobs per trader wallet. Replaces data/traders/ JSON files.';
