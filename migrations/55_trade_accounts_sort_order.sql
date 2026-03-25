-- Add sort_order to trade_accounts for user-defined ordering
ALTER TABLE trade_accounts ADD COLUMN IF NOT EXISTS sort_order integer;

-- Backfill: assign sort_order based on current default-first, then created_at order
WITH ranked AS (
  SELECT id,
    (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_default DESC, created_at ASC) - 1) AS rn
  FROM trade_accounts
)
UPDATE trade_accounts
SET sort_order = ranked.rn
FROM ranked
WHERE trade_accounts.id = ranked.id;
