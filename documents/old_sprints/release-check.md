# Alpha Release Checklist - Intelligence Feed System

**Release Date:** TBD (pending S6 completion)
**System:** Prop Firm Intelligence Feed & Weekly Email Digest
**Tech Lead Review:** Required before production deployment

---

## Critical Blockers for Alpha Release

### 🔴 HIGH PRIORITY (Must Fix Before Release)

#### 1. Subscription Email Delivery - S6 Sprint

**Status:** ❌ BLOCKED - Missing data pipeline component

**Problem:** Users are not receiving weekly emails because `firm_weekly_reports` table is either:
- Not populated with weekly report data, OR
- Missing entirely from database schema

**Root Cause:**
- The email sending route (`app/api/cron/send-weekly-reports/route.js`) correctly filters by user subscriptions ✅
- BUT it queries `firm_weekly_reports` table (line 119-124) which may be empty/missing ❌
- The workflow that populates this table (`weekly-step1-generate-firm-weekly-reports.yml`) may not exist or is failing

**S6 Tickets to Resolve:**
- [ ] **S6-001:** Verify `firm_weekly_reports` table schema exists ⚠️ **BLOCKER**
- [ ] **S6-002:** Investigate `weekly-step1` workflow status ⚠️ **BLOCKER**
- [ ] **S6-003:** Implement report generation API if missing (8 pts) ⚠️ **BLOCKER**
- [ ] **S6-004:** Fix email template to render `report_json` structure (3 pts) 🔴 **HIGH**
- [ ] **S6-005:** End-to-end testing of subscription flow (5 pts) 🔴 **HIGH**

**Investigation Steps:**

```sql
-- 1. Check if table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'firm_weekly_reports';

-- 2. Check schema (if exists)
\d firm_weekly_reports;

-- 3. Check for recent data
SELECT firm_id, week_from_date, week_to_date, created_at
FROM firm_weekly_reports
ORDER BY created_at DESC
LIMIT 10;

-- 4. Check if weekly_reports table exists (may have been renamed)
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%weekly%';
```

**Expected Table Schema:**

```sql
CREATE TABLE IF NOT EXISTS firm_weekly_reports (
  id SERIAL PRIMARY KEY,
  firm_id TEXT NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  week_from_date DATE NOT NULL,
  week_to_date DATE NOT NULL,
  report_json JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(firm_id, week_from_date, week_to_date)
);
```

**Workflow Dependencies:**

```
Sunday 7:00 UTC: weekly-step1-generate-firm-weekly-reports.yml
  ↓ Populates firm_weekly_reports table
  ↓ (1 hour gap)
Sunday 8:00 UTC: weekly-step2-send-firm-weekly-reports.yml
  ↓ Queries firm_weekly_reports
  ↓ Sends emails to users
```

**Files to Verify:**
- [.github/workflows/weekly-step1-generate-firm-weekly-reports.yml](../../.github/workflows/weekly-step1-generate-firm-weekly-reports.yml) - Does it exist?
- [app/api/cron/generate-weekly-reports/route.js](../../app/api/cron/generate-weekly-reports/route.js) - Does it exist?
- Check migration 22: [migrations/22_rename_weekly_tables_and_firm_weekly_reports_dates.sql](../../migrations/22_rename_weekly_tables_and_firm_weekly_reports_dates.sql)

---

## S5 Sprint Completion Status

### ✅ Completed Items (Removed from Checklist)

**S5 successfully delivered:**
1. ✅ Trustpilot scraper infrastructure ([lib/scrapers/trustpilot.ts](../../lib/scrapers/trustpilot.ts))
2. ✅ Intelligence feed UI ([app/propfirms/[id]/intelligence/page.js](../../app/propfirms/[id]/intelligence/page.js))
3. ✅ 30-day data window fix (changed from 90d)
4. ✅ API endpoints for incidents and signals
5. ✅ Test coverage for components and API routes (437 tests passing)
6. ✅ Admin dashboard intelligence metrics
7. ✅ Error alerting system ([lib/alerts.js](../../lib/alerts.js))
8. ✅ Database migrations (11-22) including `user_subscriptions` table
9. ✅ Subscription UI in user settings ([components/user/settings/SubscriptionsSection.js](../../components/user/settings/SubscriptionsSection.js))
10. ✅ Subscription API routes ([app/api/subscriptions/route.js](../../app/api/subscriptions/route.js))
11. ✅ Email sending route ([app/api/cron/send-weekly-reports/route.js](../../app/api/cron/send-weekly-reports/route.js))
12. ✅ Documentation and runbooks

**What's Working:**
- Users CAN subscribe/unsubscribe to firms via UI ✅
- Subscription data IS stored in `user_subscriptions` table ✅
- Email route DOES filter by user subscriptions ✅

**What's NOT Working:**
- Email route queries empty/missing `firm_weekly_reports` table ❌
- Weekly report generation workflow missing or failing ❌

---

## Environment Variables Checklist

**Required in Production (Vercel):**

- [x] `NEXT_PUBLIC_SUPABASE_URL` ✅
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- [x] `SUPABASE_SERVICE_ROLE_KEY` ✅
- [ ] `OPENAI_API_KEY` (for classification & incident summaries) ⚠️ **VERIFY SET**
- [ ] `RESEND_API_KEY` (for weekly emails) ⚠️ **VERIFY SET**
- [ ] `CRON_SECRET` (for webhook authentication) ⚠️ **VERIFY SET**
- [ ] `ALERT_EMAIL` or `ALERTS_TO` (for monitoring alerts) ⚠️ **VERIFY SET**

**Required in GitHub Secrets:**

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `CRON_SECRET`
- [ ] `SITE_URL` (e.g., https://your-app.vercel.app)

---

## Database Schema Verification

### Tables to Verify Before Deploy

1. [ ] **`user_subscriptions`** (created in migration 11, renamed in migration 20)
   - Columns: `id, user_id, firm_id, email_enabled, subscribed_at, last_sent_at`
   - Unique constraint: `(user_id, firm_id)`
   - RLS policies: enabled ✅

2. [ ] **`firm_weekly_reports`** ⚠️ **NEEDS VERIFICATION**
   - Expected columns: `id, firm_id, week_from_date, week_to_date, report_json, generated_at`
   - Unique constraint: `(firm_id, week_from_date, week_to_date)`
   - Check if table exists or was renamed from `weekly_reports`

3. [x] **`weekly_incidents`** (created in migration 11)
   - Verified in S5 ✅
   - Populated by daily-step3 workflow ✅

4. [x] **`trustpilot_reviews`** (created in migration 11)
   - Columns include `category, classified_at` ✅
   - Populated by daily-step1 workflow ✅

5. [x] **`firms`** table
   - Columns: `id, name, trustpilot_url, last_scraper_run_at` ✅
   - 8 firms seeded ✅

---

## Workflow Status

### Daily Workflows (3 AM - 5 AM PST / 11:00 - 13:00 UTC)

- [x] `daily-step1-sync-firm-trustpilot-reviews.yml` (11:00 UTC) ✅ EXISTS
- [x] `daily-step2-sync-firm-classify-reviews.yml` (12:00 UTC) ✅ EXISTS (check: sync-classify-reviews.yml)
- [x] `daily-step3-sync-firm-incidents.yml` (13:00 UTC) ✅ EXISTS

### Weekly Workflows (Sunday 7-8 AM UTC)

- [ ] `weekly-step1-generate-firm-weekly-reports.yml` (7:00 UTC) ⚠️ **VERIFY EXISTS**
- [x] `weekly-step2-send-firm-weekly-reports.yml` (8:00 UTC) ✅ EXISTS

**Action Items:**
- [ ] Check if `weekly-step1` workflow file exists in `.github/workflows/`
- [ ] If exists, check GitHub Actions logs for recent runs
- [ ] If missing, create workflow as part of S6-002/S6-003

---

## Testing Checklist

### Pre-Deployment Tests

**Unit Tests:**
- [x] 437 tests passing (`npm run test`) ✅
- [x] Coverage enforcement for new code ✅

**E2E Tests:**
- [x] Intelligence feed UI tests (`tests/e2e/intelligence-feed.spec.js`) ✅
- [ ] Subscription flow E2E test ⚠️ **S6-005**

**Manual Tests Required:**

1. [ ] **Subscription UI:**
   - [ ] User can subscribe to firm
   - [ ] User can unsubscribe from firm
   - [ ] Toggle reflects in database
   - [ ] Search and filters work

2. [ ] **Email Delivery (After S6 fixes):**
   - [ ] User with 2 subscriptions receives email with 2 firms only
   - [ ] User with 0 subscriptions receives no email
   - [ ] Email template renders correctly (firms, incidents, stats)
   - [ ] Unsubscribe link works

3. [ ] **Admin Dashboard:**
   - [ ] Intelligence metrics display
   - [ ] Subscription metrics display (if S6-006 completed)
   - [ ] Error alerts working

---

## Performance Benchmarks

**API Response Times (P95):**

- [x] `GET /api/v2/propfirms/[id]/incidents?days=30` < 500ms ✅
- [x] `GET /api/v2/propfirms/[id]/signals?days=30` < 300ms ✅

**Workflow Execution Times:**

- [x] Trustpilot scraper (8 firms × 3 pages) < 10 minutes ✅
- [ ] Report generation (8 firms) < 5 minutes ⚠️ **TO TEST AFTER S6-003**
- [ ] Weekly email reports (100 subscribers) < 5 minutes ⚠️ **TO TEST AFTER S6**

---

## Deployment Checklist

**Before deploying to production:**

### Code Quality
- [x] All tests passing (`npm run test:coverage:enforce-new`) ✅
- [x] Build succeeds (`npm run build`) ✅
- [ ] S6 tickets completed ⚠️ **IN PROGRESS**

### Database
- [ ] Verify `firm_weekly_reports` table exists ⚠️ **S6-001**
- [x] Migrations 11-22 applied in production ✅
- [ ] Run migration 23+ if needed for S6

### Environment
- [ ] All env vars configured in Vercel ⚠️ **VERIFY**
- [ ] GitHub Actions secrets configured ⚠️ **VERIFY**
- [ ] `CRON_SECRET` matches between Vercel and GitHub

### Workflows
- [ ] `weekly-step1` workflow exists and tested ⚠️ **S6-002**
- [ ] Manually trigger all workflows and verify success
- [ ] Check logs for errors

### Monitoring
- [x] Admin dashboard displaying metrics ✅
- [x] Error alerts configured ✅
- [ ] Subscription metrics added (optional - S6-006)

---

## Deployment Plan

### Phase 1: Staging Deployment
1. [ ] Merge S6 branch to `main`
2. [ ] Deploy to Vercel staging
3. [ ] Apply database migrations (if any)
4. [ ] Run smoke tests:
   - [ ] Visit intelligence feed pages
   - [ ] Subscribe to 2 firms via UI
   - [ ] Manually trigger `weekly-step1` workflow
   - [ ] Verify `firm_weekly_reports` table populated
   - [ ] Manually trigger `weekly-step2` workflow
   - [ ] Verify test email received with correct firms

### Phase 2: Production Deployment
1. [ ] Promote staging to production
2. [ ] Monitor first daily workflow runs (Mon-Fri 3-5 AM PST)
3. [ ] Monitor first weekly workflow runs (Sunday 7-8 AM UTC)
4. [ ] Check error logs and admin dashboard

### Phase 3: Post-Deploy Monitoring (48 hours)
- [ ] Day 1 (11:00 UTC): Monitor scraper workflow
- [ ] Day 1 (12:00 UTC): Monitor classifier workflow
- [ ] Day 1 (13:00 UTC): Monitor incident detection
- [ ] Week 1 (Sunday 7:00 UTC): Monitor report generation
- [ ] Week 1 (Sunday 8:00 UTC): Monitor email delivery
- [ ] Check admin dashboard daily for errors

---

## Rollback Plan

**If S6 deployment fails:**

1. **Email delivery broken:**
   - [ ] Disable `weekly-step2` workflow (comment out cron schedule)
   - [ ] Investigate `firm_weekly_reports` table
   - [ ] Check GitHub Actions logs for errors

2. **Report generation broken:**
   - [ ] Disable `weekly-step1` workflow
   - [ ] Check API endpoint `/api/cron/generate-weekly-reports`
   - [ ] Verify database queries

3. **UI broken:**
   - [ ] Revert PR
   - [ ] Redeploy previous version from git tag

4. **Database migration failure:**
   - [ ] Rollback migration via Supabase SQL Editor
   - [ ] Restore from backup if needed

---

## Sign-Off

**Tech Lead:** ___________________  **Date:** ___________

**PM:** ___________________  **Date:** ___________

---

## Sprint Timeline

- **S5 Sprint:** Completed Feb 2025 ✅
- **S6 Sprint:** Started Feb 15, 2026 (estimated 1 week)
- **Alpha Release:** Target Feb 22, 2026 (pending S6 completion)
