-- Migration 25: Add backfill_error to user_profiles for OAuth backfill debugging
-- When backfill script fails or times out, we store the error here so the user can retry from dashboard.

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS backfill_error TEXT;

COMMENT ON COLUMN user_profiles.backfill_error IS 'Last backfill script error message; null when backfill succeeded or not yet run';
