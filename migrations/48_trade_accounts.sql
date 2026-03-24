-- S14-001: trade_accounts table
-- Each user can have multiple trade accounts with a locked P&L unit type.
-- pnl_unit is set at creation and never updated (enforced in API layer).

CREATE TABLE IF NOT EXISTS trade_accounts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  pnl_unit   TEXT NOT NULL DEFAULT 'USD' CHECK (pnl_unit IN ('R', 'USD')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_accounts_user ON trade_accounts (user_id);
