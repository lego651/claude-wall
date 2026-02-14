-- Migration: Add isAdmin field to profiles table
-- Run this migration to enable admin access control

-- Add isAdmin column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index on is_admin for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Note: After running this migration, you'll need to manually set is_admin = true 
-- for users who should have admin access:
-- UPDATE profiles SET is_admin = true WHERE email = 'admin@example.com';
