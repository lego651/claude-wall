-- ============================================================================
-- VERIFICATION QUERIES FOR ALPHA INTELLIGENCE SCHEMA
-- TICKET-001: Database Schema Setup - Verification
-- ============================================================================
-- Run these queries after deploying alpha-intelligence-schema.sql
-- ============================================================================

-- ============================================================================
-- 1. VERIFY TABLES CREATED
-- ============================================================================

SELECT
  table_name,
  CASE
    WHEN table_name IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')
    THEN '✅ Created'
    ELSE '❌ Missing'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')
ORDER BY
  CASE table_name
    WHEN 'firms' THEN 1
    WHEN 'trustpilot_reviews' THEN 2
    WHEN 'firm_subscriptions' THEN 3
    WHEN 'weekly_reports' THEN 4
    WHEN 'weekly_incidents' THEN 5
  END;

-- Expected: 5 rows with '✅ Created' status

-- ============================================================================
-- 2. VERIFY FIRMS TABLE STRUCTURE
-- ============================================================================

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'firms'
ORDER BY ordinal_position;

-- Expected columns:
-- id (text, NO)
-- name (text, NO)
-- created_at (timestamp with time zone)
-- updated_at (timestamp with time zone)
-- addresses (ARRAY)
-- timezone (text)
-- website (text)
-- logo_url (text)
-- trustpilot_url (text)
-- twitter_handle (text)

-- ============================================================================
-- 3. VERIFY FIRMS SEEDED (8 firms)
-- ============================================================================

SELECT
  id,
  name,
  timezone,
  array_length(addresses, 1) as address_count,
  website,
  CASE WHEN logo_url IS NOT NULL THEN '✅ Has logo' ELSE '❌ No logo' END as logo_status
FROM firms
ORDER BY name;

-- Expected: 8 rows
-- All should have timezone = 'UTC'
-- All should have address_count = 1
-- All should have '✅ Has logo'

-- ============================================================================
-- 4. VERIFY RLS POLICIES
-- ============================================================================

SELECT
  tablename,
  policyname,
  CASE cmd
    WHEN 'SELECT' THEN 'Read'
    WHEN 'INSERT' THEN 'Create'
    WHEN 'UPDATE' THEN 'Update'
    WHEN 'DELETE' THEN 'Delete'
    ELSE cmd
  END as operation,
  CASE
    WHEN qual::text LIKE '%auth.uid()%' THEN '🔒 User-scoped'
    WHEN qual::text = 'true' THEN '🌐 Public'
    ELSE '🔐 Custom'
  END as scope
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')
ORDER BY tablename, policyname;

-- Expected policies:
-- firms: "Anyone can view firms" (Read, Public)
-- trustpilot_reviews: "Anyone can view reviews" (Read, Public)
-- firm_subscriptions: 4 policies (Read/Create/Update/Delete, User-scoped)
-- weekly_reports: "Anyone can view reports" (Read, Public)
-- weekly_incidents: "Anyone can view incidents" (Read, Public)
-- Total: ~8-10 policies

-- ============================================================================
-- 5. VERIFY INDEXES
-- ============================================================================

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')
ORDER BY tablename, indexname;

-- Expected indexes:
-- firms: idx_firms_id, firms_pkey
-- trustpilot_reviews: idx_trustpilot_firm_date, idx_trustpilot_category, idx_trustpilot_unclassified, trustpilot_reviews_pkey, trustpilot_reviews_trustpilot_url_key
-- firm_subscriptions: idx_subscriptions_user, idx_subscriptions_firm, firm_subscriptions_pkey, firm_subscriptions_user_id_firm_id_key
-- weekly_reports: idx_reports_firm_week, idx_reports_recent, weekly_reports_pkey, weekly_reports_firm_id_week_number_year_key
-- weekly_incidents: idx_incidents_firm_week, idx_incidents_severity, weekly_incidents_pkey
-- Total: ~17+ indexes

-- ============================================================================
-- 6. VERIFY FOREIGN KEYS
-- ============================================================================

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')
ORDER BY tc.table_name, kcu.column_name;

-- Expected foreign keys:
-- trustpilot_reviews.firm_id → firms.id
-- firm_subscriptions.user_id → auth.users.id
-- firm_subscriptions.firm_id → firms.id
-- weekly_reports.firm_id → firms.id
-- weekly_incidents.firm_id → firms.id
-- Total: 5 foreign keys

-- ============================================================================
-- 7. VERIFY CONSTRAINTS
-- ============================================================================

SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')
  AND tc.constraint_type IN ('CHECK', 'UNIQUE')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Expected constraints:
-- trustpilot_reviews:
--   - CHECK: rating (1-5)
--   - CHECK: severity (low/medium/high)
--   - CHECK: valid_category
--   - UNIQUE: trustpilot_url
-- firm_subscriptions:
--   - UNIQUE: (user_id, firm_id)
-- weekly_reports:
--   - CHECK: week_number (1-53)
--   - CHECK: year (2024-2100)
--   - UNIQUE: (firm_id, week_number, year)
-- weekly_incidents:
--   - CHECK: incident_type
--   - CHECK: severity
--   - CHECK: week_number (1-53)
--   - CHECK: year (2024-2100)

-- ============================================================================
-- 8. VERIFY HELPER FUNCTIONS
-- ============================================================================

SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_week_number', 'get_year', 'update_updated_at_column')
ORDER BY routine_name;

-- Expected: 3 functions
-- get_week_number (FUNCTION, integer)
-- get_year (FUNCTION, integer)
-- update_updated_at_column (FUNCTION, trigger)

-- ============================================================================
-- 9. VERIFY TRIGGERS
-- ============================================================================

SELECT
  trigger_name,
  event_object_table as table_name,
  action_timing as timing,
  event_manipulation as event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'firms'
ORDER BY trigger_name;

-- Expected: 1 trigger
-- update_firms_updated_at (BEFORE UPDATE)

-- ============================================================================
-- 10. TEST HELPER FUNCTIONS
-- ============================================================================

-- Test get_week_number function
SELECT
  '2026-01-30'::DATE as test_date,
  get_week_number('2026-01-30'::DATE) as week_number,
  CASE
    WHEN get_week_number('2026-01-30'::DATE) BETWEEN 1 AND 53 THEN '✅ Valid'
    ELSE '❌ Invalid'
  END as status;

-- Test get_year function
SELECT
  '2026-01-30'::DATE as test_date,
  get_year('2026-01-30'::DATE) as year,
  CASE
    WHEN get_year('2026-01-30'::DATE) = 2026 THEN '✅ Correct'
    ELSE '❌ Incorrect'
  END as status;

-- ============================================================================
-- 11. VERIFY TABLE ROW COUNTS (should be 0 initially except firms)
-- ============================================================================

SELECT 'firms' as table_name, COUNT(*) as row_count FROM firms
UNION ALL
SELECT 'trustpilot_reviews', COUNT(*) FROM trustpilot_reviews
UNION ALL
SELECT 'firm_subscriptions', COUNT(*) FROM firm_subscriptions
UNION ALL
SELECT 'weekly_reports', COUNT(*) FROM weekly_reports
UNION ALL
SELECT 'weekly_incidents', COUNT(*) FROM weekly_incidents;

-- Expected:
-- firms: 8
-- trustpilot_reviews: 0 (will be populated by scraper)
-- firm_subscriptions: 0 (will be populated when users subscribe)
-- weekly_reports: 0 (will be generated weekly)
-- weekly_incidents: 0 (will be created from reviews)

-- ============================================================================
-- 12. COMPREHENSIVE VERIFICATION SUMMARY
-- ============================================================================

WITH verification AS (
  SELECT 'Tables Created' as check_name,
    CASE WHEN COUNT(*) = 5 THEN '✅ PASS' ELSE '❌ FAIL' END as status
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')

  UNION ALL

  SELECT 'Firms Seeded',
    CASE WHEN COUNT(*) = 8 THEN '✅ PASS' ELSE '❌ FAIL' END
  FROM firms

  UNION ALL

  SELECT 'RLS Policies Applied',
    CASE WHEN COUNT(*) >= 8 THEN '✅ PASS' ELSE '❌ FAIL' END
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')

  UNION ALL

  SELECT 'Indexes Created',
    CASE WHEN COUNT(*) >= 15 THEN '✅ PASS' ELSE '❌ FAIL' END
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')

  UNION ALL

  SELECT 'Foreign Keys Created',
    CASE WHEN COUNT(*) = 5 THEN '✅ PASS' ELSE '❌ FAIL' END
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name IN ('trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents')

  UNION ALL

  SELECT 'Helper Functions Created',
    CASE WHEN COUNT(*) >= 3 THEN '✅ PASS' ELSE '❌ FAIL' END
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN ('get_week_number', 'get_year', 'update_updated_at_column')
)
SELECT * FROM verification;

-- ============================================================================
-- Expected Result: All checks should show '✅ PASS'
-- ============================================================================
-- If any check shows '❌ FAIL', review the corresponding section above
-- ============================================================================
