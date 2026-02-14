-- Migration: Add display_name, bio, and handle fields to profiles table
-- Run this migration to support the new dashboard features

-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS handle TEXT;

-- Create index on handle for faster lookups (useful for trader profile pages)
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(handle) WHERE handle IS NOT NULL;

-- Note: These fields are optional and can be null
-- The API will handle validation and normalization
