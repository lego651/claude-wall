-- Add optional default P&L value per trade account.
-- When set, the Log a Trade modal will pre-fill the P&L field with this value.
-- Unit is determined by the account's pnl_unit (R or USD).
ALTER TABLE trade_accounts
  ADD COLUMN IF NOT EXISTS default_pnl float8 DEFAULT NULL;
