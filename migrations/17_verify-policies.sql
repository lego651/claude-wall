-- Verify and fix RLS policies for profiles table
-- Run this in Supabase SQL Editor

-- First, check current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Drop existing INSERT policy if it exists (to recreate it correctly)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Recreate the INSERT policy with correct definition
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'INSERT';
