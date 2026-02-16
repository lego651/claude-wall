-- ============================================================================
-- DEBUG: Why are emails being skipped? (0 sent, 0 failed, 2 skipped)
-- Run these queries in Supabase SQL Editor to diagnose
-- ============================================================================

-- Query 1: Check all users with subscriptions (should show your 3 test users)
SELECT
  us.user_id,
  p.email,
  us.firm_id,
  us.email_enabled,
  us.subscribed_at
FROM user_subscriptions us
LEFT JOIN profiles p ON p.id = us.user_id
WHERE us.email_enabled = true
ORDER BY p.email, us.firm_id;

-- Expected: Should show legogao651@gmail.com with their subscribed firms
-- If NO ROWS: User has no subscriptions → needs to subscribe via UI
-- If email_enabled = false: User has disabled emails → toggle in UI


-- Query 2: Check which firms have reports for CURRENT WEEK
-- (This is what the email route queries)
SELECT
  firm_id,
  week_from_date,
  week_to_date,
  generated_at,
  report_json->>'firmId' as report_firm_id,
  report_json->>'weekStart' as report_week_start
FROM firm_weekly_reports
WHERE week_from_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY generated_at DESC;

-- Expected: Should show 8 rows (one per firm) for current week
-- If NO ROWS: Report generation workflow (weekly-step1) didn't run or failed
-- If OLD DATES: Reports are stale, need to re-run weekly-step1


-- Query 3: DIAGNOSIS - Match users to available reports
-- This shows which users SHOULD receive emails
WITH current_week_reports AS (
  SELECT DISTINCT firm_id
  FROM firm_weekly_reports
  WHERE week_from_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT
  p.email,
  us.user_id,
  us.firm_id,
  CASE
    WHEN cwr.firm_id IS NOT NULL THEN '✅ HAS REPORT'
    ELSE '❌ NO REPORT'
  END as report_status
FROM user_subscriptions us
LEFT JOIN profiles p ON p.id = us.user_id
LEFT JOIN current_week_reports cwr ON cwr.firm_id = us.firm_id
WHERE us.email_enabled = true
ORDER BY p.email, us.firm_id;

-- Expected: All rows should show '✅ HAS REPORT'
-- If '❌ NO REPORT': User subscribed to firm that has no report this week


-- Query 4: Count emails that SHOULD be sent
-- This mimics the logic in send-weekly-reports route
WITH current_week_reports AS (
  SELECT firm_id, report_json
  FROM firm_weekly_reports
  WHERE week_from_date >= CURRENT_DATE - INTERVAL '7 days'
),
user_reports AS (
  SELECT
    us.user_id,
    p.email,
    COUNT(cwr.firm_id) as report_count
  FROM user_subscriptions us
  LEFT JOIN profiles p ON p.id = us.user_id
  LEFT JOIN current_week_reports cwr ON cwr.firm_id = us.firm_id
  WHERE us.email_enabled = true
  GROUP BY us.user_id, p.email
)
SELECT
  email,
  report_count,
  CASE
    WHEN report_count = 0 THEN '⏭️ SKIPPED (no reports)'
    WHEN report_count > 0 THEN '✅ SHOULD SEND EMAIL'
  END as status
FROM user_reports
ORDER BY email;

-- Expected for legogao651@gmail.com: report_count > 0 → '✅ SHOULD SEND EMAIL'
-- If report_count = 0 → '⏭️ SKIPPED' → User has subscriptions but no reports


-- Query 5: Check current week calculation
-- Verify what week the system thinks is "current"
SELECT
  CURRENT_DATE as today,
  CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::integer + 1 as week_start_monday,
  CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::integer + 7 as week_end_sunday,
  (CURRENT_DATE - INTERVAL '7 days')::date as seven_days_ago;

-- This shows what the "current week" range should be


-- Query 6: SOLUTION - What needs to happen?
-- Run this to see action items
SELECT
  '1. Run weekly-step1 workflow if no recent reports' as step_1,
  '2. Check user subscriptions exist (Query 1)' as step_2,
  '3. Verify report dates match current week (Query 2)' as step_3,
  '4. Match should show ✅ HAS REPORT for all subscriptions (Query 3)' as step_4;


-- ============================================================================
-- QUICK FIXES (if needed)
-- ============================================================================

-- Fix A: If legogao651@gmail.com has NO subscriptions, add some:
-- (Replace USER_ID with actual UUID from profiles table)
/*
INSERT INTO user_subscriptions (user_id, firm_id, email_enabled)
VALUES
  ('YOUR_USER_ID', 'fundingpips', true),
  ('YOUR_USER_ID', 'fxify', true)
ON CONFLICT (user_id, firm_id) DO UPDATE
SET email_enabled = true;
*/

-- Fix B: If reports are missing/old, manually trigger weekly-step1 workflow
-- OR run the script locally:
-- npx tsx scripts/generate-firm-weekly-reports.ts

-- Fix C: Check if profiles table has email for user
/*
SELECT id, email FROM profiles
WHERE email LIKE '%legogao651%';
*/
