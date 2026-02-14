-- Rename firm_subscriptions to user_subscriptions (user-centric naming).
-- Table was created in 11_alpha-intelligence-schema.sql; all policies/indexes move with the table.

ALTER TABLE firm_subscriptions RENAME TO user_subscriptions;

-- Align constraint names with new table name
ALTER TABLE user_subscriptions
  RENAME CONSTRAINT firm_subscriptions_pkey TO user_subscriptions_pkey;

ALTER TABLE user_subscriptions
  RENAME CONSTRAINT firm_subscriptions_user_id_firm_id_key TO user_subscriptions_user_id_firm_id_key;

-- Align index names with new table name
ALTER INDEX idx_subscriptions_user RENAME TO idx_user_subscriptions_user;

ALTER INDEX idx_subscriptions_firm RENAME TO idx_user_subscriptions_firm;
