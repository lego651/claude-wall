# Alpha Release Checklist - Intelligence Feed System

**Release Date:** TBD
**System:** Prop Firm Intelligence Feed & Weekly Email Digest
**Tech Lead Review:** Required before production deployment

---

## System Overview

The Intelligence Feed system is an async data pipeline that scrapes Trustpilot reviews, classifies them using OpenAI, detects incidents, and delivers weekly aggregated reports to subscribed users.

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ASYNC DATA PIPELINE                          │
└─────────────────────────────────────────────────────────────────┘

Daily 3 AM PST (11:00 UTC)
  ↓
┌─────────────────────┐
│ 1. Scrape Reviews   │ → Playwright scraper → trustpilot_reviews table
│    (3 pages/firm)   │    (lib/scrapers/trustpilot.ts)
└──────────┬──────────┘
           │ 1 hour delay
           ↓
Daily 4 AM PST (12:00 UTC)
┌─────────────────────┐
│ 2. Classify Reviews │ → OpenAI GPT-4 → category field updated
│    (Unclassified)   │    (scripts/classify-firm-unclassified-trustpilot-reviews.ts)
└──────────┬──────────┘
           │ 1 hour delay
           ↓
Daily 5 AM PST (13:00 UTC)
┌─────────────────────┐
│ 3. Detect Incidents │ → Aggregate by week → weekly_incidents table
│    (Current Week)   │    (scripts/run-firm-daily-incidents.ts)
└──────────┬──────────┘
           │ 9 hours
           ↓
Weekly Mon 2 PM UTC (14:00 UTC)
┌─────────────────────┐
│ 4. Send Reports     │ → Query subscribers → Email via Resend
│    (Weekly Digest)  │    (app/api/cron/send-weekly-reports)
└─────────────────────┘

UI Consumption:
┌─────────────────────────────────────────────────────────────────┐
│ /propfirms/[id]          → Intelligence Feed (last 3, 30d data)  │
│ /propfirms/[id]/intelligence → Full feed (30d filter, 30d data) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Intelligence Feed UI (Per-Firm)

### 1.1 Overview Page (`/propfirms/fundingpips`)

**File:** [app/propfirms/[id]/page.js](../../app/propfirms/[id]/page.js)

**Status:** ✅ IMPLEMENTED

**Verification Steps:**

- [ ] Navigate to `/propfirms/fundingpips`
- [ ] Scroll to "Intelligence Feed" section (line 400-438)
- [ ] Verify section shows:
  - [ ] Title: "Intelligence Feed"
  - [ ] Link: "Live Reports" → navigates to `/propfirms/fundingpips/intelligence`
  - [ ] Last 3 incidents displayed (from 30-day data)
  - [ ] Each incident shows:
    - [ ] Severity badge (high/medium/low with color coding)
    - [ ] Incident type (e.g., "PAYOUT DELAY")
    - [ ] Week detected date
    - [ ] Title and summary text
    - [ ] Hover effect on card

**API Endpoint:** `GET /api/v2/propfirms/[id]/incidents?days=30`

- [ ] Returns incidents from `weekly_incidents` table
- [ ] Includes `source_links` (up to 3 Trustpilot URLs per incident)
- [ ] Test file exists: [app/api/v2/propfirms/[id]/incidents/route.test.js](../../app/api/v2/propfirms/[id]/incidents/route.test.js)

**Data Requirements:**

- [ ] Database table `weekly_incidents` exists and populated
- [ ] Incidents have valid `firm_id`, `week_number`, `year`, `severity`, `title`, `summary`
- [ ] Review IDs resolve to Trustpilot URLs in `trustpilot_reviews` table

**Edge Cases:**

- [ ] No incidents in 30 days → Shows "No recent incidents in the last 30 days"
- [ ] Loading state → Shows spinner
- [ ] API failure → Graceful error (currently no error UI shown)

---

### 1.2 Intelligence Feed Page (`/propfirms/fundingpips/intelligence`)

**File:** [app/propfirms/[id]/intelligence/page.js](../../app/propfirms/[id]/intelligence/page.js)

**Status:** ✅ IMPLEMENTED (30 days)

**Current Implementation:**

- Line 138: `fetch(/api/v2/propfirms/${firmId}/incidents?days=30)`
- Displays last 30 days of data
- Description text: "last 30 days"

**Verification Steps:**

- [ ] Navigate to `/propfirms/fundingpips/intelligence`
- [ ] Verify header shows:
  - [ ] Title: "Firm Intelligence Feed"
  - [ ] Description: "Curated, summarized, and classified signals from the last 30 days"
  - [ ] Filter dropdown: "All Types" / "Reputation" / "Operational" / "Regulatory"
  - [ ] Filter icon button (non-functional decoration)
- [ ] Verify timeline rendering:
  - [ ] Vertical timeline line on left
  - [ ] Each incident shows as [IntelligenceCard](../../components/propfirms/intelligence/IntelligenceCard.js)
  - [ ] Dot indicator (colored by category)
  - [ ] Title, summary, confidence badge, tags, source links
- [ ] Test filtering:
  - [ ] "All Types" → shows all incidents
  - [ ] "Operational" → filters to support_issue, payout_delay, etc.
  - [ ] "Reputation" → filters to scam_warning, rules_dispute, etc.
- [ ] Verify footer CTA:
  - [ ] "Want real-time alerts?" section renders
  - [ ] "Enable Notifications" button present (non-functional)

**Components:**

- [ ] [IntelligenceCard.js](../../components/propfirms/intelligence/IntelligenceCard.js) - Test coverage exists ✅
- [ ] [IntelligenceCardSkeleton.js](../../components/propfirms/intelligence/IntelligenceCardSkeleton.js) - Test coverage exists ✅

**Edge Cases:**

- [ ] No incidents → Shows "No intelligence signals in the last 30 days"
- [ ] No matches for filter → Shows "No incidents match the selected type"
- [ ] Loading → Shows 3 skeleton cards

---

## Feature 2: Weekly Email Reports

**Workflow:** [.github/workflows/step4-send-weekly-reports-weekly.yml](../../.github/workflows/step4-send-weekly-reports-weekly.yml)

**Status:** ❌ CRITICAL - Missing implementation

**Cron Schedule:** Every Monday 14:00 UTC (after daily incidents at 13:00 UTC)

### 2.1 API Endpoint

**Expected:** `POST /api/cron/send-weekly-reports`

**Current Status:** ❌ EMPTY DIRECTORY

- Directory exists: `app/api/cron/send-weekly-reports/`
- No `route.js` or `route.ts` file found
- Workflow calls this endpoint with `Authorization: Bearer $CRON_SECRET`

**Required Implementation:**

- [ ] Create `app/api/cron/send-weekly-reports/route.js`
- [ ] Implement:
  1. CRON_SECRET authentication
  2. Query `user_subscriptions` table for active subscribers
  3. For each user, query subscribed firms' incidents from past week
  4. Aggregate incidents by firm
  5. Generate HTML email with weekly digest
  6. Send via [lib/resend.ts](../../lib/resend.ts)
  7. Log success/failure per user
  8. Return summary: `{ sent: N, failed: M, errors: [...] }`

### 2.2 Database Schema

**Missing Tables:**

- [ ] `user_subscriptions` (user_id, firm_id, email, active, created_at)
- [ ] Schema migration file needed in [migrations/](../../migrations/)

**Email Service:**

- [ ] [lib/resend.ts](../../lib/resend.ts) ✅ EXISTS
- [ ] Requires `RESEND_API_KEY` environment variable
- [ ] Uses `config.resend.fromNoReply` for sender

### 2.3 Email Template

**Required Fields:**

- [ ] Subject: "Weekly Prop Firm Intelligence Digest - [Week of YYYY-MM-DD]"
- [ ] Body (HTML):
  - [ ] Personalized greeting
  - [ ] Per-firm sections with incidents from past week
  - [ ] Incident cards: severity, type, title, summary, source links
  - [ ] Unsubscribe link
  - [ ] Footer with company info

### 2.4 Verification Steps

- [ ] Manually trigger workflow: `workflow_dispatch` in GitHub Actions
- [ ] Check logs for successful API call
- [ ] Verify email sent to test subscriber
- [ ] Check email rendering in multiple clients (Gmail, Outlook, Apple Mail)
- [ ] Test unsubscribe flow
- [ ] Monitor for errors in production after first Monday run

**Edge Cases:**

- [ ] No subscribers → Log "No active subscribers" and return 200
- [ ] No incidents for week → Send "quiet week" email or skip?
- [ ] Resend API failure → Log error, return 500, retry on next run
- [ ] CRON_SECRET mismatch → Return 403 Forbidden

---

## Feature 3: Async Scraping System

### 3.1 Trustpilot Scraper

**Workflow:** [.github/workflows/step1-sync-trustpilot-reviews-daily.yml](../../.github/workflows/step1-sync-trustpilot-reviews-daily.yml)

**Script:** `scripts/backfill-firm-trustpilot-reviews.ts` ❌ NOT FOUND

**Status:** ⚠️ SCRIPT MISSING but scraper lib exists

**Implementation:** [lib/scrapers/trustpilot.ts](../../lib/scrapers/trustpilot.ts) ✅ EXISTS

**Cron Schedule:** Daily 3 AM PST (11:00 UTC)

**Verification Steps:**

- [ ] Create `scripts/backfill-firm-trustpilot-reviews.ts` to call `scrapeAndStoreReviews()` for all firms
- [ ] Test scraper locally:
  ```bash
  npx tsx scripts/backfill-firm-trustpilot-reviews.ts
  ```
- [ ] Verify it scrapes 3 pages × ~20 reviews/page = ~60 reviews per firm
- [ ] Check `trustpilot_reviews` table for new rows
- [ ] Verify duplicate detection (unique constraint on `trustpilot_url`)
- [ ] Monitor Playwright browser launch in GitHub Actions
- [ ] Check runtime: should complete within 15-minute timeout

**Supported Firms:**

```typescript
fundednext, the5ers, fundingpips, alphacapitalgroup, blueguardian,
aquafunded, instantfunding, fxify
```

(FTMO and TopStep NOT supported - no Trustpilot URLs)

**Database Table:**

- [ ] `trustpilot_reviews` (id, firm_id, rating, title, review_text, reviewer_name, review_date, trustpilot_url, category, classified_at)
- [ ] Unique constraint on `trustpilot_url`

**Edge Cases:**

- [ ] Trustpilot blocks scraper → Playwright stealth mode configured ✅
- [ ] No reviews on page 2/3 → Stops pagination gracefully ✅
- [ ] Review date parsing fails → Fallback to current date ✅

---

### 3.2 Review Classification

**Workflow:** [.github/workflows/sync-classify-reviews.yml](../../.github/workflows/sync-classify-reviews.yml)

**Script:** `scripts/classify-firm-unclassified-trustpilot-reviews.ts` ❌ NOT FOUND

**Status:** ❌ CRITICAL - Missing implementation

**Cron Schedule:** Daily 4 AM PST (12:00 UTC), 1 hour after scraper

**Required Implementation:**

- [ ] Create `scripts/classify-firm-unclassified-trustpilot-reviews.ts`
- [ ] Query `trustpilot_reviews` WHERE `classified_at IS NULL`
- [ ] Batch process (e.g., 50 reviews at a time to respect OpenAI rate limits)
- [ ] Call OpenAI GPT-4 with classification prompt:
  - Input: `review_text`, `title`, `rating`
  - Output: `category` (one of INCIDENT_TYPE_TO_CATEGORY keys from [intelligence/types.js](../../app/propfirms/[id]/intelligence/types.js))
- [ ] Update `category` and `classified_at` fields
- [ ] Log: `{ total: N, classified: M, failed: K, duration: Xms }`

**Categories:**

```
Operational: platform_technical_issue, support_issue, payout_delay,
             payout_denied, kyc_withdrawal_issue, execution_conditions

Reputation: high_risk_allegation, scam_warning, rules_dispute,
            pricing_fee_complaint, payout_issue, platform_issue,
            rule_violation, other

Positive: positive_experience, positive

Neutral: neutral_mixed, neutral
```

**Verification Steps:**

- [ ] Manually trigger workflow
- [ ] Check `trustpilot_reviews` table for updated `category` values
- [ ] Verify `classified_at` timestamp is set
- [ ] Monitor OpenAI API usage and costs
- [ ] Check for classification accuracy (manual review of sample)

**Edge Cases:**

- [ ] OpenAI API failure → Retry with exponential backoff, skip and log error
- [ ] Rate limit exceeded → Slow down batch processing
- [ ] Ambiguous review → Default to "other" category

---

### 3.3 Incident Detection

**Workflow:** [.github/workflows/step3-run-daily-incidents-daily.yml](../../.github/workflows/step3-run-daily-incidents-daily.yml)

**Script:** `scripts/run-firm-daily-incidents.ts` ❌ NOT FOUND

**Status:** ❌ CRITICAL - Missing implementation

**Cron Schedule:** Daily 5 AM PST (13:00 UTC), 1 hour after classification

**Required Implementation:**

- [ ] Create `scripts/run-firm-daily-incidents.ts`
- [ ] For each firm in `TRUSTPILOT_FIRM_IDS`:
  1. Get current ISO week number and year
  2. Query `trustpilot_reviews` for current week, grouped by `category`
  3. Detect if category count exceeds threshold (e.g., ≥5 negative reviews)
  4. If incident detected:
     - Generate `title` and `summary` using OpenAI (aggregate review texts)
     - Determine `severity` (high/medium/low based on count and rating)
     - Extract `review_ids` (up to 10 review IDs for source links)
  5. Upsert to `weekly_incidents` table:
     - `ON CONFLICT (firm_id, year, week_number, incident_type) DO UPDATE`
     - Update `title`, `summary`, `severity`, `review_count`, `review_ids`

**Database Table:**

- [ ] `weekly_incidents` (id, firm_id, week_number, year, incident_type, severity, title, summary, review_count, affected_users, review_ids, created_at)
- [ ] Unique constraint on `(firm_id, year, week_number, incident_type)`

**Detection Logic:**

- [ ] Severity thresholds:
  - High: ≥10 reviews OR avg rating ≤2.0
  - Medium: ≥5 reviews OR avg rating ≤3.0
  - Low: ≥3 reviews

**Verification Steps:**

- [ ] Manually trigger workflow
- [ ] Check `weekly_incidents` table for new rows
- [ ] Verify `review_ids` array contains valid IDs
- [ ] Verify `title` and `summary` are coherent (manual review)
- [ ] Test upsert: re-run same week should update, not duplicate

**Edge Cases:**

- [ ] No incidents for current week → No inserts, log "No incidents detected"
- [ ] OpenAI summary generation fails → Use fallback template summary
- [ ] Multiple incident types in same week → Each gets separate row

---

## Feature 4: Monitoring & Observability

### 4.1 Admin Dashboard Enhancement

**Current:** [app/admin/dashboard/page.js](../../app/admin/dashboard/page.js)

**Status:** ✅ EXISTS but needs Intelligence Feed monitoring

**Required Additions:**

Add new monitoring panel after "Prop firms payout data" section (around line 433):

#### Panel: Intelligence Feed Pipeline

**Metrics to Display:**

1. **Scraper Status:**
   - [ ] Last run timestamp (from `firms.last_scraper_run_at` - NEW FIELD)
   - [ ] Total reviews scraped (count from `trustpilot_reviews`)
   - [ ] Scraper errors (new `scraper_errors` log table)

2. **Classification Status:**
   - [ ] Unclassified reviews count (WHERE `classified_at IS NULL`)
   - [ ] Last classification run timestamp
   - [ ] Classification error rate (failed / total)

3. **Incident Detection:**
   - [ ] Current week incidents count (per firm)
   - [ ] Last incident detection run timestamp
   - [ ] Incidents by severity: High / Medium / Low

4. **Weekly Email Reports:**
   - [ ] Last report sent timestamp
   - [ ] Subscribers count (from `user_subscriptions`)
   - [ ] Delivery success rate (sent / total)
   - [ ] Email errors log (last 10)

**API Endpoint:**

- [ ] Extend `GET /api/admin/metrics` to include intelligence feed metrics
- [ ] Add to existing response:
  ```json
  {
    "intelligenceFeed": {
      "scraper": { "lastRun": "ISO timestamp", "reviewsCount": N, "errors": [...] },
      "classifier": { "unclassified": N, "lastRun": "ISO timestamp", "errorRate": 0.05 },
      "incidents": { "currentWeek": N, "byFirm": {...}, "bySeverity": {...} },
      "emailReports": { "lastSent": "ISO timestamp", "subscribers": N, "successRate": 0.95 }
    }
  }
  ```

**Verification Steps:**

- [ ] Navigate to `/admin/dashboard`
- [ ] Verify new "Intelligence Feed Pipeline" section renders
- [ ] Check all metrics display correctly
- [ ] Test auto-refresh (30-second interval)
- [ ] Verify CSV export includes new metrics

---

### 4.2 Error Alerts

**Current:** Admin dashboard has email alerts for critical failures ✅

**Required:**

- [ ] Add intelligence feed failures to alert conditions:
  - Scraper fails 3 consecutive runs
  - Unclassified reviews > 500 (backlog too large)
  - Incident detection fails
  - Weekly email report delivery < 80% success rate

**Implementation:**

- [ ] Extend `lib/alerts.js` (or create if missing)
- [ ] Check in `/api/admin/metrics` endpoint
- [ ] Send email via Resend if threshold exceeded
- [ ] Throttle: max 1 alert per condition per 4 hours

---

## Test Coverage Requirements

### Unit Tests (≥80% coverage enforced by pre-commit hook)

**Files Requiring Tests:**

- [ ] `app/api/v2/propfirms/[id]/incidents/route.js` ✅ HAS TEST
- [ ] `app/api/v2/propfirms/[id]/signals/route.js` ✅ HAS TEST
- [ ] `lib/scrapers/trustpilot.ts` ❌ NO TEST (create `lib/__tests__/scrapers/trustpilot.test.ts`)
- [ ] `scripts/classify-firm-unclassified-trustpilot-reviews.ts` ❌ SCRIPT MISSING
- [ ] `scripts/run-firm-daily-incidents.ts` ❌ SCRIPT MISSING
- [ ] `scripts/backfill-firm-trustpilot-reviews.ts` ❌ SCRIPT MISSING
- [ ] `app/api/cron/send-weekly-reports/route.js` ❌ ROUTE MISSING

**Component Tests:**

- [ ] [IntelligenceCard.test.js](../../components/__tests__/propfirms/intelligence/IntelligenceCard.test.js) ✅ EXISTS
- [ ] [IntelligenceCardSkeleton.test.js](../../components/__tests__/propfirms/intelligence/IntelligenceCardSkeleton.test.js) ✅ EXISTS

### Integration Tests

**E2E Tests (Playwright):**

- [ ] Create `e2e/intelligence-feed.spec.js`:
  - [ ] Test `/propfirms/fundingpips` intelligence section
  - [ ] Test `/propfirms/fundingpips/intelligence` full page
  - [ ] Test filtering by category
  - [ ] Test loading states
  - [ ] Test no data states

**API Tests:**

- [ ] Test incident endpoint with various `days` params
- [ ] Test error handling (invalid firm_id, missing data)
- [ ] Test source_links resolution

**Workflow Tests:**

- [ ] Manually trigger each GitHub Actions workflow:
  - [ ] `step1-sync-trustpilot-reviews-daily.yml`
  - [ ] `step2-sync-classify-reviews-daily.yml`
  - [ ] `step3-run-daily-incidents-daily.yml`
  - [ ] `step4-send-weekly-reports-weekly.yml`
- [ ] Verify success in Actions logs
- [ ] Check database for expected changes

---

## Environment Variables Checklist

**Required in Production (Vercel):**

- [ ] `NEXT_PUBLIC_SUPABASE_URL` ✅
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ✅
- [ ] `OPENAI_API_KEY` (for classification & incident summaries)
- [ ] `RESEND_API_KEY` (for weekly emails)
- [ ] `CRON_SECRET` (for webhook authentication)
- [ ] `ALERT_EMAIL` or `ALERTS_TO` (for monitoring alerts)

**Required in GitHub Secrets:**

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `CRON_SECRET`
- [ ] `SITE_URL` (e.g., https://your-app.vercel.app)

---

## Database Migration Checklist

**New Tables Needed:**

1. [ ] `user_subscriptions`
   ```sql
   CREATE TABLE user_subscriptions (
     id SERIAL PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     firm_id TEXT NOT NULL,
     email TEXT NOT NULL,
     active BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE (user_id, firm_id)
   );
   ```

2. [ ] `weekly_incidents` - Verify exists with correct schema
   - Columns: id, firm_id, week_number, year, incident_type, severity, title, summary, review_count, affected_users, review_ids, created_at
   - Unique constraint: `(firm_id, year, week_number, incident_type)`

3. [ ] `trustpilot_reviews` - Verify exists
   - Add `category` TEXT field if missing
   - Add `classified_at` TIMESTAMPTZ field if missing
   - Unique constraint: `trustpilot_url`

**Firm Metadata:**

- [ ] Add `last_scraper_run_at` TIMESTAMPTZ to `firms` table

**Migration Files:**

- [ ] Create `migrations/XX_intelligence_feed_schema.sql` (where XX is next number)
- [ ] Update [migrations/README.md](../../migrations/README.md)
- [ ] Run migrations in Supabase SQL Editor or via psql

---

## Performance Benchmarks

**API Response Times (P95):**

- [ ] `GET /api/v2/propfirms/[id]/incidents?days=30` < 500ms
- [ ] `GET /api/v2/propfirms/[id]/signals?days=30` < 300ms

**Workflow Execution Times:**

- [ ] Trustpilot scraper (8 firms × 3 pages) < 10 minutes
- [ ] Classification (50 reviews batch) < 3 minutes
- [ ] Incident detection (8 firms) < 2 minutes
- [ ] Weekly email reports (100 subscribers) < 5 minutes

**Database Query Optimization:**

- [ ] Add index on `trustpilot_reviews(firm_id, review_date)` for scraper dedup
- [ ] Add index on `trustpilot_reviews(classified_at)` for classifier query
- [ ] Add index on `weekly_incidents(firm_id, year, week_number)` for UI query

---

## Critical Blockers for Alpha Release

### HIGH PRIORITY (Must Fix)

1. ❌ **Missing Scripts:**
   - [ ] `scripts/backfill-firm-trustpilot-reviews.ts`
   - [ ] `scripts/classify-firm-unclassified-trustpilot-reviews.ts`
   - [ ] `scripts/run-firm-daily-incidents.ts`

2. ❌ **Missing API Route:**
   - [ ] `app/api/cron/send-weekly-reports/route.js`

3. ❌ **Database Schema:**
   - [ ] `user_subscriptions` table
   - [ ] Verify `weekly_incidents` table structure
   - [ ] Verify `trustpilot_reviews` has `category` and `classified_at` fields

4. ✅ **UI Data Range:** Intelligence page uses 30 days (done).

### MEDIUM PRIORITY (Should Fix)

5. ✅ **Test Coverage:** (done)
   - [x] `lib/scrapers/trustpilot.ts` unit tests
   - [x] E2E test for intelligence feed pages (`tests/e2e/intelligence-feed.spec.js`)
   - [x] API route tests for send-weekly-reports

6. ✅ **Monitoring:** (done)
   - [x] Intelligence feed metrics in admin dashboard (`intelligenceFeed` in `/api/admin/metrics`)
   - [x] Error alerts for pipeline (`lib/alerts.js` checkIntelligenceFeedAlerts)

### LOW PRIORITY (Nice to Have)

7. [ ] Email template design (HTML/CSS)
8. [ ] Unsubscribe flow implementation
9. [ ] User subscription UI (allow users to subscribe to firms)

---

## Sign-Off

**Before deploying to production:**

- [ ] All HIGH PRIORITY items resolved
- [ ] All tests passing (`npm run test:coverage:enforce-new`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual QA completed on staging
- [ ] Environment variables configured in Vercel
- [ ] GitHub Actions secrets configured
- [ ] Database migrations applied in production
- [ ] Monitoring dashboard verified
- [ ] Error alerts tested (send test email)

**Deployment Plan:**

1. Merge feature branch to `main`
2. Deploy to staging (Vercel preview)
3. Run smoke tests on staging
4. Promote to production
5. Monitor first scraper run (next day 3 AM PST)
6. Monitor first weekly email send (next Monday 2 PM UTC)
7. Check error logs and dashboard metrics

**Rollback Plan:**

- If scraper fails → Disable workflow, investigate logs, fix script, re-enable
- If email send fails → Check Resend logs, verify RESEND_API_KEY, fix route
- If UI breaks → Revert PR, redeploy previous version
- Database migration failure → Rollback using Supabase UI or psql

---

**Tech Lead Approval:** ___________________  **Date:** ___________

**PM Approval:** ___________________  **Date:** ___________
