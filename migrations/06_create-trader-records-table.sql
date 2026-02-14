-- Migration: Create trader_records table for caching trader transaction data
-- This table stores aggregated transaction statistics for each trader wallet
-- Updated every 30 minutes via sync job to avoid Arbiscan API rate limits

CREATE TABLE IF NOT EXISTS trader_records (
  wallet_address TEXT PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Aggregated statistics
  total_payout_usd DECIMAL(18,2) DEFAULT 0,
  last_30_days_payout_usd DECIMAL(18,2) DEFAULT 0,
  avg_payout_usd DECIMAL(18,2) DEFAULT 0,
  payout_count INTEGER DEFAULT 0,
  
  -- Transaction metadata
  first_payout_at TIMESTAMPTZ,
  last_payout_at TIMESTAMPTZ,
  last_payout_tx_hash TEXT,
  
  -- Sync metadata
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trader_records_profile_id ON trader_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_trader_records_total_payout ON trader_records(total_payout_usd DESC);
CREATE INDEX IF NOT EXISTS idx_trader_records_last_synced ON trader_records(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_trader_records_last_30d ON trader_records(last_30_days_payout_usd DESC);

-- Enable Row Level Security
ALTER TABLE trader_records ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read trader records (for leaderboard)
CREATE POLICY "Public can view trader records"
  ON trader_records
  FOR SELECT
  USING (true);

-- Policy: Service role can insert/update (for sync job)
-- Note: This requires service role key, which bypasses RLS
-- We'll use service role in the sync script

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trader_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_trader_records_updated_at ON trader_records;
CREATE TRIGGER update_trader_records_updated_at
  BEFORE UPDATE ON trader_records
  FOR EACH ROW
  EXECUTE FUNCTION update_trader_records_updated_at();

-- Comments
COMMENT ON TABLE trader_records IS 'Cached transaction statistics for trader wallets. Updated every 30 minutes via sync job.';
COMMENT ON COLUMN trader_records.wallet_address IS 'Trader wallet address (primary key)';
COMMENT ON COLUMN trader_records.profile_id IS 'Reference to profiles table (nullable, for users with profiles)';
COMMENT ON COLUMN trader_records.total_payout_usd IS 'Total verified payout amount in USD';
COMMENT ON COLUMN trader_records.last_30_days_payout_usd IS 'Total payout in last 30 days';
COMMENT ON COLUMN trader_records.last_synced_at IS 'Last time data was synced from Arbiscan';
