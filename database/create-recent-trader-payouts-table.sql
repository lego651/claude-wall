-- Migration: Create recent_trader_payouts table for 24h rolling realtime data
-- Mirrors recent_payouts (firms): individual payout rows, kept for last 24 hours only.
-- Updated every 5 minutes via Inngest sync job.

CREATE TABLE IF NOT EXISTS recent_trader_payouts (
  tx_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  payment_method TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  from_address TEXT,
  to_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_recent_trader_payouts_wallet ON recent_trader_payouts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_recent_trader_payouts_timestamp ON recent_trader_payouts(timestamp);

ALTER TABLE recent_trader_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view recent trader payouts"
  ON recent_trader_payouts
  FOR SELECT
  USING (true);

COMMENT ON TABLE recent_trader_payouts IS 'Last 24h of incoming payouts per trader wallet. Updated every 5 min by Inngest.';
