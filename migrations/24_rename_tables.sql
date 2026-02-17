-- Migration 24: Rename tables for clearer naming
-- firms -> firm_profiles
-- profiles -> user_profiles
-- recent_payouts -> firm_recent_payouts
-- recent_trader_payouts -> trader_recent_payouts
-- trader_payout_history -> trader_history_payouts
-- trustpilot_reviews -> firm_trustpilot_reviews

-- Drop triggers that reference tables we're renaming (they will be recreated on new names)
DROP TRIGGER IF EXISTS sync_subscription_email_trigger ON profiles;
DROP TRIGGER IF EXISTS auto_subscribe_new_user_trigger ON profiles;

-- Rename tables
ALTER TABLE IF EXISTS firms RENAME TO firm_profiles;
ALTER TABLE IF EXISTS profiles RENAME TO user_profiles;
ALTER TABLE IF EXISTS recent_payouts RENAME TO firm_recent_payouts;
ALTER TABLE IF EXISTS recent_trader_payouts RENAME TO trader_recent_payouts;
ALTER TABLE IF EXISTS trader_payout_history RENAME TO trader_history_payouts;
ALTER TABLE IF EXISTS trustpilot_reviews RENAME TO firm_trustpilot_reviews;

-- Recreate trigger function to use new table name (firm_profiles)
CREATE OR REPLACE FUNCTION auto_subscribe_new_user()
RETURNS TRIGGER AS $$
DECLARE
  firm_record RECORD;
BEGIN
  FOR firm_record IN
    SELECT id FROM firm_profiles WHERE trustpilot_url IS NOT NULL
  LOOP
    INSERT INTO user_subscriptions (user_id, firm_id, email, email_enabled, subscribed_at)
    VALUES (NEW.id, firm_record.id, NEW.email, true, NOW())
    ON CONFLICT (user_id, firm_id) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers on user_profiles
CREATE TRIGGER sync_subscription_email_trigger
  AFTER INSERT OR UPDATE OF email ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_email();

CREATE TRIGGER auto_subscribe_new_user_trigger
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_subscribe_new_user();

COMMENT ON TABLE firm_profiles IS 'Prop firm master data (renamed from firms)';
COMMENT ON TABLE user_profiles IS 'User profile and auth metadata (renamed from profiles)';
COMMENT ON TABLE firm_recent_payouts IS 'Last 24h firm payouts (renamed from recent_payouts)';
COMMENT ON TABLE trader_recent_payouts IS 'Last 24h trader payouts (renamed from recent_trader_payouts)';
COMMENT ON TABLE trader_history_payouts IS 'Monthly trader payout blobs (renamed from trader_payout_history)';
COMMENT ON TABLE firm_trustpilot_reviews IS 'Trustpilot reviews per firm (renamed from trustpilot_reviews)';
