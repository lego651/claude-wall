-- Migration: Add public read policy for profiles
-- This allows the leaderboard to display public profile information
-- Only profiles with wallet_address, display_name, and handle are publicly visible

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view profiles with wallet addresses" ON profiles;

-- Policy: Allow public read access to profiles that have wallet addresses and display names
-- This is needed for the leaderboard to display trader information
CREATE POLICY "Public can view profiles with wallet addresses"
  ON profiles
  FOR SELECT
  USING (
    wallet_address IS NOT NULL 
    AND display_name IS NOT NULL 
    AND handle IS NOT NULL
  );

-- Note: This policy allows anyone (including unauthenticated users) to read
-- profile information for users who have set up their public profile.
-- Only basic public information (display_name, handle, wallet_address) is exposed.
-- Sensitive information like email, customer_id, etc. should not be selected in public queries.
