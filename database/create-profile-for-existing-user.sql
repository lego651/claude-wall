-- Run this SQL to create a profile for an existing user
-- Replace 'user-email@example.com' with the actual email of the user

INSERT INTO profiles (id, email)
SELECT id, email
FROM auth.users
WHERE email = 'user-email@example.com'
ON CONFLICT (id) DO NOTHING;

-- Or to create profiles for ALL existing users who don't have one:
INSERT INTO profiles (id, email)
SELECT id, email
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;
