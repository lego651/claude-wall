# TICKET-001: Database Schema Setup - COMPLETED ✅

**Date:** 2026-01-30
**Estimate:** 2 hours
**Status:** READY FOR DEPLOYMENT (v2 - Fixed for existing `firms` table)

---

## Summary

Created complete database schema for Alpha Intelligence Engine (Trustpilot-based weekly reports).

**Update v2:** Migration now handles existing `firms` table gracefully by:
- Using `ALTER TABLE ADD COLUMN IF NOT EXISTS` logic
- UPSERT for firm data (updates existing, inserts new)
- Safe to run on both fresh and existing databases

## Files Created

1. **[alpha-intelligence-schema.sql](alpha-intelligence-schema.sql)** (345 lines)
   - Complete migration script with all 5 tables
   - RLS policies for security
   - Indexes for performance
   - Helper functions
   - Seed data for 8 existing firms

2. **[README.md](README.md)** (Updated)
   - Migration instructions
   - Verification queries
   - Rollback procedures
   - Environment variables checklist

## Database Schema Created

### Tables

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `firms` | Firm reference data | 8 firms seeded, public read access |
| `trustpilot_reviews` | Scraped reviews | AI classification fields, dedupe by URL |
| `firm_subscriptions` | User subscriptions | RLS per user, unique per user+firm |
| `weekly_reports` | Cached reports | JSONB storage, email metrics |
| `weekly_incidents` | Aggregated incidents | AI summaries, review references |

### Key Features

✅ **Row Level Security (RLS)** enabled on all tables
✅ **Indexes** optimized for:
- Firm + date queries
- Unclassified review lookups
- User subscription queries
- Recent reports

✅ **Foreign Keys** ensuring data integrity
✅ **Check Constraints** validating data (ratings 1-5, severity levels, etc.)
✅ **Unique Constraints** preventing duplicates

## Acceptance Criteria ✅

- [x] Create `trustpilot_reviews` table with all required fields
- [x] Create `firm_subscriptions` table with user/firm relationship
- [x] Create `weekly_reports` table with JSONB storage
- [x] Create `weekly_incidents` table with review references
- [x] Create `firms` table for reference integrity
- [x] Add all indexes for performance
- [x] Apply RLS policies (users can only access their own subscriptions)
- [x] Seed 8 firms from propfirms.json
- [x] Documentation for running migration
- [x] Verification queries provided
- [x] Rollback script provided

## How to Deploy

### Step 1: Navigate to Supabase Dashboard
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
```

### Step 2: Copy SQL
```bash
# Copy the entire contents of:
migrations/11_alpha-intelligence-schema.sql
```

### Step 3: Paste & Run
1. Paste into SQL Editor
2. Click "Run" button
3. Wait for success message

### Step 4: Verify
```sql
-- Should return 8 firms
SELECT id, name FROM firms;

-- Should return 5 tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents');

-- Should return ~15 policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('firms', 'trustpilot_reviews', 'firm_subscriptions', 'weekly_reports', 'weekly_incidents');
```

## Expected Results

After successful migration:
- ✅ 5 new tables created
- ✅ 8 firms inserted
- ✅ 15+ RLS policies active
- ✅ 10+ indexes created
- ✅ 2 helper functions added

## Next Ticket

Proceed to **[TICKET-002: Trustpilot Scraper Implementation](../roadmap/alpha_tickets.md#ticket-002-trustpilot-scraper-implementation)**

---

## Notes for Developer

- Migration is idempotent (can be run multiple times safely)
- Uses `IF NOT EXISTS` and `ON CONFLICT` for safety
- RLS policies prevent unauthorized data access
- Service role key needed for cron jobs (scraping, classification)
- Firms table can be expanded with more fields later (Trustpilot URL, Twitter handle, etc.)

## Potential Issues & Solutions

### Issue: "permission denied for table firms"
**Solution:** Ensure RLS policies are created (they are in the migration)

### Issue: "relation 'auth.users' does not exist"
**Solution:** You're not connected to Supabase. This table exists in Supabase by default.

### Issue: "duplicate key value violates unique constraint"
**Solution:** Normal if running migration twice. Firms will be updated with `ON CONFLICT DO UPDATE`.

### Issue: "function update_updated_at_column() does not exist"
**Solution:** Run `schema.sql` first (it creates this function for profiles table)

---

**Status:** ✅ READY FOR PRODUCTION
**Blocked by:** None
**Blocks:** TICKET-002, TICKET-005, TICKET-009, TICKET-012
