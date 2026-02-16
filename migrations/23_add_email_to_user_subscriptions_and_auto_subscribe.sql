-- ============================================================================
-- Migration 23: Add email column to user_subscriptions + Auto-subscribe logic
-- ============================================================================
-- Purpose:
--   1. Add email column to user_subscriptions (denormalized from profiles)
--   2. Backfill email for existing subscriptions
--   3. Create trigger to auto-subscribe new users to all firms
-- ============================================================================

-- =============================================================================
-- PART 1: Add email column and backfill
-- =============================================================================

-- Add email column (nullable initially for backfill)
ALTER TABLE user_subscriptions
ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill email from profiles table for existing subscriptions
UPDATE user_subscriptions us
SET email = p.email
FROM profiles p
WHERE us.user_id = p.id
  AND us.email IS NULL
  AND p.email IS NOT NULL;

-- Create index for email-based queries (used by send-weekly-reports)
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_email
  ON user_subscriptions(email)
  WHERE email_enabled = true;

-- Make email NOT NULL after backfill (optional - comment out if you want to keep nullable)
-- ALTER TABLE user_subscriptions
-- ALTER COLUMN email SET NOT NULL;

COMMENT ON COLUMN user_subscriptions.email IS 'Denormalized from profiles.email for faster email queries. Updated via trigger on profile changes.';

-- =============================================================================
-- PART 2: Trigger to keep email in sync with profiles table
-- =============================================================================

-- When user updates email in profiles, update all their subscriptions
CREATE OR REPLACE FUNCTION sync_subscription_email()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT or UPDATE of profiles.email, sync to user_subscriptions
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email) THEN
    UPDATE user_subscriptions
    SET email = NEW.email
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_subscription_email_trigger ON profiles;
CREATE TRIGGER sync_subscription_email_trigger
  AFTER INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_email();

-- =============================================================================
-- PART 3: Auto-subscribe new users to all firms
-- =============================================================================

-- Function to auto-subscribe new user to all firms with Trustpilot URLs
CREATE OR REPLACE FUNCTION auto_subscribe_new_user()
RETURNS TRIGGER AS $$
DECLARE
  firm_record RECORD;
BEGIN
  -- Get all firms that have Trustpilot URLs (these are the ones we send reports for)
  FOR firm_record IN
    SELECT id FROM firms WHERE trustpilot_url IS NOT NULL
  LOOP
    -- Insert subscription for each firm (ignore if already exists)
    INSERT INTO user_subscriptions (user_id, firm_id, email, email_enabled, subscribed_at)
    VALUES (NEW.id, firm_record.id, NEW.email, true, NOW())
    ON CONFLICT (user_id, firm_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_subscribe_new_user_trigger ON profiles;
CREATE TRIGGER auto_subscribe_new_user_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_subscribe_new_user();

-- =============================================================================
-- PART 4: Backfill subscriptions for existing users who have none
-- =============================================================================

-- Find users in profiles who have NO subscriptions, and subscribe them to all firms
DO $$
DECLARE
  user_record RECORD;
  firm_record RECORD;
BEGIN
  -- For each user with no subscriptions
  FOR user_record IN
    SELECT p.id, p.email
    FROM profiles p
    LEFT JOIN user_subscriptions us ON us.user_id = p.id
    WHERE us.id IS NULL
      AND p.email IS NOT NULL
  LOOP
    -- Subscribe to all firms with Trustpilot
    FOR firm_record IN
      SELECT id FROM firms WHERE trustpilot_url IS NOT NULL
    LOOP
      INSERT INTO user_subscriptions (user_id, firm_id, email, email_enabled, subscribed_at)
      VALUES (user_record.id, firm_record.id, user_record.email, true, NOW())
      ON CONFLICT (user_id, firm_id) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Auto-subscribed user % to all firms', user_record.email;
  END LOOP;
END $$;

-- =============================================================================
-- PART 5: Update RLS policies (email column doesn't change security model)
-- =============================================================================

-- Policies remain the same - users can only see/modify their own subscriptions
-- No changes needed to existing RLS policies

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check email column added and populated
-- SELECT user_id, firm_id, email, email_enabled FROM user_subscriptions LIMIT 10;

-- Check subscriptions count per user
-- SELECT email, COUNT(*) as subscription_count
-- FROM user_subscriptions
-- GROUP BY email
-- ORDER BY subscription_count DESC;

-- Check users without subscriptions (should be 0 after migration)
-- SELECT p.email
-- FROM profiles p
-- LEFT JOIN user_subscriptions us ON us.user_id = p.id
-- WHERE us.id IS NULL AND p.email IS NOT NULL;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
