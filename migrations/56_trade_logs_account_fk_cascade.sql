-- Change FK from trade_logs.account_id → trade_accounts.id
-- from ON DELETE SET NULL to ON DELETE CASCADE,
-- so deleting a trade account also removes all its trade logs.

-- Also delete any orphaned logs (account_id IS NULL) left by the old SET NULL behavior.
DELETE FROM trade_logs WHERE account_id IS NULL;

ALTER TABLE trade_logs
  DROP CONSTRAINT fk_trade_logs_account;

ALTER TABLE trade_logs
  ADD CONSTRAINT fk_trade_logs_account
  FOREIGN KEY (account_id) REFERENCES trade_accounts(id) ON DELETE CASCADE;
