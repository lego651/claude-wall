-- Migration: Add backfilled_at column to profiles table
-- This tracks when a user's wallet history has been fully backfilled

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS backfilled_at TIMESTAMPTZ;

-- Add index for querying backfill status
CREATE INDEX IF NOT EXISTS idx_profiles_backfilled_at ON profiles(backfilled_at);

-- Comment
COMMENT ON COLUMN profiles.backfilled_at IS 'Timestamp when wallet transaction history was fully backfilled from blockchain';
