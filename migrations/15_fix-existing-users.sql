-- Create profiles for all existing users who don't have one
-- Run this in Supabase SQL Editor

INSERT INTO profiles (id, email)
SELECT 
  id, 
  email
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles WHERE id IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- Verify the results
SELECT 
  u.id,
  u.email,
  p.id as profile_id,
  p.email as profile_email
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;
