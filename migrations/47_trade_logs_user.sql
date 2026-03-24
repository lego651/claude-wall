-- S14-001: Extend trade_logs with user_id, account_id, pnl
-- Adds user binding and P&L tracking to trade log entries.
-- Existing rows: all new columns remain NULL (orphaned; not shown in /logs).

ALTER TABLE trade_logs
  ADD COLUMN IF NOT EXISTS user_id    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD COLUMN IF NOT EXISTS pnl        NUMERIC;  -- null = not recorded; unit derived from account

CREATE INDEX IF NOT EXISTS idx_trade_logs_user_date
  ON trade_logs (user_id, trade_at DESC);
