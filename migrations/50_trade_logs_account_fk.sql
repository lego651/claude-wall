-- S14-001 fix: add missing FK from trade_logs.account_id → trade_accounts.id
-- Migration 47 added account_id as a bare UUID with no FK constraint,
-- so Supabase PostgREST cannot resolve the join used in /api/trade-log/daily and /monthly.

ALTER TABLE trade_logs
  ADD CONSTRAINT fk_trade_logs_account
  FOREIGN KEY (account_id) REFERENCES trade_accounts(id) ON DELETE SET NULL;
