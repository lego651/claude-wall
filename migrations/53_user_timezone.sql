-- S14-002: Add preferred_timezone to user_trading_settings
-- Stores the user's preferred timezone for displaying trade date/time.
-- NULL means use the browser's detected timezone (UTC offset applied client-side).

ALTER TABLE user_trading_settings
  ADD COLUMN IF NOT EXISTS preferred_timezone TEXT;
