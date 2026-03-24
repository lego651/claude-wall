-- Move daily trade limit from global user_trading_settings to per-account.
-- Nullable: when null, no limit gauge is shown in the UI.
ALTER TABLE trade_accounts
  ADD COLUMN IF NOT EXISTS daily_trade_limit int DEFAULT NULL;
