-- Create a temporary table to store pending wallet addresses during OAuth flow
-- This table holds wallet addresses for users who are in the middle of signing in

CREATE TABLE IF NOT EXISTS pending_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pending_wallets_session_id ON pending_wallets(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_wallets_expires_at ON pending_wallets(expires_at);

-- Auto-delete expired entries (cleanup)
CREATE OR REPLACE FUNCTION cleanup_expired_pending_wallets()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_wallets WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON TABLE pending_wallets IS 'Temporary storage for wallet addresses during OAuth sign-in flow';
