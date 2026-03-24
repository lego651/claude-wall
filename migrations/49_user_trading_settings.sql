-- S14-001: user_trading_settings table
-- Stores per-user trading preferences (e.g. daily trade limit).

CREATE TABLE IF NOT EXISTS user_trading_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_trade_limit INT NOT NULL DEFAULT 3 CHECK (daily_trade_limit >= 1),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
