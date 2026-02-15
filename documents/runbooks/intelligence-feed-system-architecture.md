# Intelligence Feed System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DAILY ASYNC PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ Trustpilot   │ (Source of Truth)
│ Website      │
└──────┬───────┘
       │
       │ Daily 3 AM PST (11:00 UTC)
       │ GitHub Actions: sync-trustpilot-reviews.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 1: SCRAPE                                                           │
│ scripts/backfill-trustpilot.ts (MISSING ❌)                             │
│ ├─ Playwright headless browser                                          │
│ ├─ 8 firms × 3 pages × ~20 reviews = ~480 reviews/day                   │
│ └─ Dedupe by trustpilot_url                                             │
└──────┬───────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Supabase: trustpilot_reviews                       │
│  ┌────────────────────────────────────────────┐     │
│  │ id | firm_id | rating | review_text |      │     │
│  │ title | reviewer_name | review_date |      │     │
│  │ trustpilot_url | category | classified_at  │     │
│  └────────────────────────────────────────────┘     │
└──────┬──────────────────────────────────────────────┘
       │
       │ 1 hour delay
       │ Daily 4 AM PST (12:00 UTC)
       │ GitHub Actions: sync-classify-reviews.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 2: CLASSIFY                                                         │
│ scripts/classify-unclassified-reviews.ts                                │
│ ├─ Query: WHERE classified_at IS NULL                                   │
│ ├─ OpenAI (gpt-4o-mini): batch of 20 reviews per API call (cost)        │
│ ├─ Env CLASSIFY_AI_BATCH_SIZE: default 20, max 25                       │
│ ├─ 20+ categories (operational, reputation, positive, etc.)             │
│ └─ Update: SET category = X, classified_at = NOW()                      │
└──────┬───────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Supabase: trustpilot_reviews                       │
│  (category field now populated)                     │
└──────┬──────────────────────────────────────────────┘
       │
       │ 1 hour delay
       │ Daily 5 AM PST (13:00 UTC)
       │ GitHub Actions: run-daily-incidents.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 3: DETECT INCIDENTS                                                 │
│ scripts/run-daily-incidents.ts (MISSING ❌)                             │
│ ├─ Group reviews by: firm_id, current_week, category                    │
│ ├─ Threshold: ≥3 reviews = incident                                     │
│ ├─ OpenAI GPT-4: aggregate → title + summary                            │
│ ├─ Severity: high (≥10 reviews), medium (≥5), low (≥3)                  │
│ └─ Upsert to weekly_incidents (dedupe by firm+week+type)                │
└──────┬───────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Supabase: weekly_incidents                         │
│  ┌────────────────────────────────────────────┐     │
│  │ id | firm_id | year | week_number |        │     │
│  │ incident_type | severity | title |         │     │
│  │ summary | review_count | review_ids        │     │
│  └────────────────────────────────────────────┘     │
└──────┬──────────────────────────────────────────────┘
       │
       │ 9 hours delay
       │ Weekly Monday 2 PM UTC (14:00 UTC)
       │ GitHub Actions: send-weekly-reports.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 4: EMAIL DIGEST                                                     │
│ GET /api/cron/send-weekly-reports                                        │
│ ├─ Query: user_subscriptions WHERE email_enabled = true                 │
│ ├─ For each user: weekly_reports (report_json) for subscribed firms     │
│ │   (last week’s week_number/year)                                      │
│ ├─ sendWeeklyDigest(user, reports[], options) → HTML + Resend           │
│ └─ One email per user (content = that user’s firms only)                  │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  User Inbox 📧                                      │
│  "Weekly Intelligence Digest - Week of YYYY-MM-DD"  │
└─────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                             UI CONSUMPTION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────────────┐
                              │  Supabase Database       │
                              │  ├─ trustpilot_reviews   │
                              │  ├─ weekly_incidents     │
                              │  ├─ weekly_reports       │
                              │  └─ user_subscriptions   │
                              └────────┬─────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
         ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
         │ API Endpoint     │  │ API Endpoint │  │ Admin API    │
         │ GET /api/v2/     │  │ GET /api/v2/ │  │ GET /api/    │
         │ propfirms/[id]/  │  │ propfirms/   │  │ admin/       │
         │ incidents        │  │ [id]/signals │  │ metrics      │
         │ ?days=30         │  │ ?days=30     │  │              │
         └────────┬─────────┘  └──────┬───────┘  └──────┬───────┘
                  │                   │                  │
                  ▼                   ▼                  ▼
       ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
       │ UI: Intelligence│  │ UI: Overview    │  │ UI: Admin       │
       │ Feed Page       │  │ Page            │  │ Dashboard       │
       │                 │  │                 │  │                 │
       │ /propfirms/     │  │ /propfirms/     │  │ /admin/         │
       │ [id]/           │  │ [id]            │  │ dashboard       │
       │ intelligence    │  │                 │  │                 │
       │                 │  │ (shows last 3   │  │ (pipeline       │
       │ (shows last 30d)│  │  incidents)     │  │  metrics)       │
       └─────────────────┘  └─────────────────┘  └─────────────────┘
                │                   │                  │
                └───────────────────┴──────────────────┘
                              │
                              ▼
                      ┌──────────────────┐
                      │  User Browser    │
                      │  (Next.js SSR)   │
                      └──────────────────┘
```

## Data Flow Summary

### 1. SCRAPE (Daily 3 AM PST)
```
Trustpilot → Playwright → trustpilot_reviews (raw, unclassified)
```

### 2. CLASSIFY (Daily 4 AM PST)
```
trustpilot_reviews (WHERE classified_at IS NULL)
  → OpenAI GPT-4
  → UPDATE category, classified_at
```

### 3. DETECT (Daily 5 AM PST)
```
trustpilot_reviews (current week, grouped by category)
  → Aggregate + threshold check (≥3 reviews)
  → OpenAI GPT-4 (generate title + summary)
  → UPSERT weekly_incidents
```

### 4. EMAIL (Weekly Monday 2 PM UTC)
```
user_subscriptions (email_enabled)
  → weekly_reports (report_json, last week, user's firms)
  → sendWeeklyDigest → HTML + Resend → User inbox
```

### 5. RENDER (Real-time)
```
weekly_incidents (last 30 days)
  → API: /api/v2/propfirms/[id]/incidents?days=30
  → UI: /propfirms/[id]/intelligence
  → User browser
```

## weekly_reports vs weekly_incidents

| Table | Purpose | Grain | Used by |
|-------|---------|--------|---------|
| **weekly_incidents** | One row per detected incident (e.g. “payout delays” from ≥3 reviews). | Many rows per firm per week (0 to N incidents). | UI incidents API; also consumed by report generator. |
| **weekly_reports** | One cached “full report” per firm per week (payouts + Trustpilot + incidents + “Our Take”). | One row per (firm_id, week_number, year). `report_json` holds the full snapshot. | Weekly digest cron: reads `report_json` to build each user’s email. |

```
                    trustpilot_reviews (classified)
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
  detectIncidents()     generateWeeklyReport()   (reviews + payouts)
         │                    │
         │                    │  report_json = { payouts, trustpilot,
         │                    │                  incidents[], ourTake }
         ▼                    ▼
  weekly_incidents       weekly_reports
  (many rows per         (one row per firm/week;
   firm/week)             used by send-weekly-reports)
```

- **weekly_incidents**: written by incident-detection step; each row = one incident (type, severity, title, summary). APIs and UI query this for “last 30d incidents.”
- **weekly_reports**: written by `lib/digest/generator.ts` (when a report is generated). Holds a full week snapshot per firm. The **weekly email** uses `weekly_reports.report_json` (not a direct query to `weekly_incidents`) so each user gets one email with payouts + Trustpilot + incidents + ourTake for their subscribed firms.

## Database Schema

### trustpilot_reviews
```sql
┌─────────────────┬──────────────┬─────────────────────────┐
│ Field           │ Type         │ Description             │
├─────────────────┼──────────────┼─────────────────────────┤
│ id              │ SERIAL       │ Primary key             │
│ firm_id         │ TEXT         │ e.g., "fundingpips"     │
│ rating          │ INTEGER      │ 1-5 stars               │
│ title           │ TEXT         │ Review title            │
│ review_text     │ TEXT         │ Review body             │
│ reviewer_name   │ TEXT         │ User name               │
│ review_date     │ DATE         │ When posted             │
│ trustpilot_url  │ TEXT UNIQUE  │ Source link (dedupe)    │
│ category        │ TEXT         │ Set by classifier       │
│ classified_at   │ TIMESTAMPTZ  │ When classified         │
│ created_at      │ TIMESTAMPTZ  │ When scraped            │
└─────────────────┴──────────────┴─────────────────────────┘
```

### weekly_reports
One row per (firm_id, week_number, year). Cached output of the report generator; used by the weekly digest cron.
```sql
┌─────────────────┬──────────────┬─────────────────────────┐
│ Field           │ Type         │ Description             │
├─────────────────┼──────────────┼─────────────────────────┤
│ id              │ SERIAL       │ Primary key             │
│ firm_id         │ TEXT         │ FK firms(id)            │
│ week_number     │ INT          │ ISO week (1-53)        │
│ year            │ INT          │ ISO year                │
│ report_json     │ JSONB        │ payouts, trustpilot,    │
│                 │              │ incidents[], ourTake   │
│ total_subscribers │ INT        │ Optional metric         │
│ emails_sent     │ INT          │ Optional metric         │
│ generated_at    │ TIMESTAMPTZ  │ When generated          │
├─────────────────┴──────────────┴─────────────────────────┤
│ UNIQUE (firm_id, week_number, year)                       │
└───────────────────────────────────────────────────────────┘
```
Populated by `lib/digest/generator.ts` → `generateWeeklyReport()`. Read by `GET /api/cron/send-weekly-reports` to build digest emails.

### weekly_incidents
Many rows per firm per week (0 or more). One row = one detected incident (e.g. “payout delays” from ≥3 reviews).
```sql
┌─────────────────┬──────────────┬─────────────────────────┐
│ Field           │ Type         │ Description             │
├─────────────────┼──────────────┼─────────────────────────┤
│ id              │ SERIAL       │ Primary key             │
│ firm_id         │ TEXT         │ FK firms(id)            │
│ year            │ INT          │ ISO year                │
│ week_number     │ INT          │ ISO week (1-53)         │
│ incident_type   │ TEXT         │ payout_issue,           │
│                 │              │ scam_warning, etc.      │
│ severity        │ TEXT         │ low | medium | high     │
│ title           │ TEXT         │ AI-generated            │
│ summary         │ TEXT         │ AI-generated            │
│ review_count    │ INT          │ # reviews in incident   │
│ affected_users  │ TEXT         │ Optional estimate       │
│ review_ids      │ INT[]        │ Source review IDs       │
│ created_at      │ TIMESTAMPTZ  │ When detected           │
└─────────────────┴──────────────┴─────────────────────────┘
```
Written by incident-detection script. Read by UI/API (`/api/v2/propfirms/[id]/incidents`) and by the report generator (to embed in `weekly_reports.report_json`).

### user_subscriptions
```sql
┌─────────────────┬──────────────┬─────────────────────────┐
│ Field           │ Type         │ Description             │
├─────────────────┼──────────────┼─────────────────────────┤
│ id              │ UUID         │ Primary key             │
│ user_id         │ UUID         │ FK auth.users            │
│ firm_id         │ TEXT         │ Subscribed firm          │
│ email_enabled   │ BOOLEAN      │ Include in digest        │
│ created_at      │ TIMESTAMPTZ  │ When subscribed          │
├─────────────────┴──────────────┴─────────────────────────┤
│ UNIQUE (user_id, firm_id)                                │
└───────────────────────────────────────────────────────────┘
```
Email comes from `profiles` (join by user_id). One user → many firms; digest = reports for that user’s subscribed firms only.

## Incident Categories

### Operational Issues (affects service delivery)
```
platform_technical_issue   → Platform crashes, API failures
support_issue             → Unresponsive support, language barriers
payout_delay              → Delayed but eventually paid
payout_denied             → Withdrawal blocked
kyc_withdrawal_issue      → KYC verification problems
execution_conditions      → Order execution, slippage, spreads
```

### Reputation Issues (affects trust)
```
high_risk_allegation      → Fraud accusations, manipulation
scam_warning              → Scam claims, theft
rules_dispute             → Disagreements over rules
pricing_fee_complaint     → Fee complaints
payout_issue              → General payout problems
platform_issue            → General platform complaints
rule_violation            → Firm claims trader broke rules
other                     → Uncategorized
```

### Positive/Neutral
```
positive_experience       → Satisfied users
positive                  → General positive sentiment
neutral_mixed             → Mixed feedback
neutral                   → Neutral statements
```

## Incident Severity Thresholds

```
HIGH    → ≥10 reviews in category OR avg rating ≤2.0
MEDIUM  → ≥5 reviews in category OR avg rating ≤3.0
LOW     → ≥3 reviews in category
```

## GitHub Actions Workflows

### 1. sync-trustpilot-reviews.yml
```yaml
Cron: 0 11 * * *  (3 AM PST / 11:00 UTC)
Runs: npx tsx scripts/backfill-trustpilot.ts
Env:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### 2. sync-classify-reviews.yml
```yaml
Cron: 0 12 * * *  (4 AM PST / 12:00 UTC)
Runs: npx tsx scripts/classify-unclassified-reviews.ts
Env:  OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

**Classifier batch size (API cost):** Reviews are sent to OpenAI in batches of **20 per API call** (default). Env `CLASSIFY_AI_BATCH_SIZE` can override; max 25 to keep response accuracy. See `lib/ai/classifier.ts` (`CLASSIFY_AI_BATCH_SIZE_DEFAULT`, `classifyReviewBatch`).

**Classification scope and policy:** This step **only** processes unclassified reviews (`WHERE classified_at IS NULL`). Already-classified rows are never re-sent. All classification paths use the **batch API** (20 reviews per OpenAI call); the script and `lib/ai/batch-classify.ts` both call `classifyReviewBatch()`.

**Related files (no duplication):**
| File | Purpose | Batch size |
|------|---------|------------|
| `lib/ai/classification-taxonomy.ts` | Single source of truth: category list, incident rules, legacy mapping. Used by classifier, incident-aggregator, generator. | — |
| `lib/ai/classifier.ts` | Single- and batch OpenAI calls (`classifyReview`, `classifyReviewBatch`), DB helpers. | 20 per API call (max 25) |
| `lib/ai/batch-classify.ts` | Library: `runBatchClassification()` — fetch unclassified, call `classifyReviewBatch`, write DB. Same batch size as script. | 20 (env override) |
| `scripts/classify-unclassified-reviews.ts` | Cron entry point (sync-classify-reviews.yml). Uses `classifyReviewBatch`; supports MAX_PER_RUN, delay. | 20 (env override) |

### 3. run-daily-incidents.yml
```yaml
Cron: 0 13 * * *  (5 AM PST / 13:00 UTC)
Runs: npx tsx scripts/run-daily-incidents.ts
Env:  OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### 4. send-weekly-reports.yml
```yaml
Cron: 0 14 * * 1  (Monday 2 PM UTC)
Runs: curl -H "Authorization: Bearer $CRON_SECRET" $SITE_URL/api/cron/send-weekly-reports
Env:  CRON_SECRET, SITE_URL
```

## API Endpoints

### GET /api/v2/propfirms/[id]/incidents
```
Query: ?days=30 (default 90)
Returns: Array of incidents with source_links
Used by: Intelligence feed page
```

### GET /api/v2/propfirms/[id]/signals
```
Query: ?days=30
Returns: Payout summary + Trustpilot sentiment
Used by: Overview page (currently)
```

### POST /api/cron/send-weekly-reports
```
Auth: Bearer $CRON_SECRET
Returns: { sent: N, failed: M, errors: [...] }
Used by: GitHub Actions weekly workflow
```

## File Locations

```
Code:
├── lib/scrapers/trustpilot.ts           ✅ EXISTS
├── scripts/backfill-trustpilot.ts       ❌ MISSING
├── scripts/classify-unclassified-reviews.ts  ✅ EXISTS (batch size 20)
├── scripts/run-daily-incidents.ts       ❌ MISSING
├── app/api/cron/send-weekly-reports/route.js  ❌ MISSING
├── app/propfirms/[id]/page.js           ✅ EXISTS (intelligence section)
├── app/propfirms/[id]/intelligence/page.js    ✅ EXISTS
└── components/propfirms/intelligence/
    ├── IntelligenceCard.js              ✅ EXISTS
    └── IntelligenceCardSkeleton.js      ✅ EXISTS

Database:
├── migrations/XX_user_subscriptions.sql      ❌ NEEDED
├── migrations/XX_weekly_incidents.sql        ⚠️ VERIFY EXISTS
└── migrations/XX_trustpilot_reviews_fields.sql  ⚠️ VERIFY category+classified_at

Workflows:
├── .github/workflows/sync-trustpilot-reviews.yml      ✅ EXISTS
├── .github/workflows/sync-classify-reviews.yml        ✅ EXISTS
├── .github/workflows/run-daily-incidents.yml          ✅ EXISTS
└── .github/workflows/send-weekly-reports.yml          ✅ EXISTS
```

## Environment Variables

**Local runs:** Put keys in **`.env`** at project root. Scripts (e.g. `backfill-trustpilot.ts`) load `.env` via `dotenv/config`—do not `export` vars in the shell.

### Production (Vercel)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
OPENAI_API_KEY=sk-xxx...
RESEND_API_KEY=re_xxx...
CRON_SECRET=random-secret-string
ALERT_EMAIL=alerts@company.com
```

### GitHub Secrets
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
OPENAI_API_KEY=sk-xxx...
CRON_SECRET=random-secret-string (must match Vercel)
SITE_URL=https://your-app.vercel.app
```

## Cost Estimates

### OpenAI API (GPT-4-turbo)
```
Classification: ~$0.01/review
- 480 reviews/day × $0.01 = $4.80/day = ~$145/month

Incident summaries: ~$0.05/incident
- ~50 incidents/week × $0.05 = $2.50/week = ~$10/month

Total: ~$155/month
```

### Resend API
```
Free tier: 3,000 emails/month
Paid: $20/month for 50,000 emails

Expected: 100 subscribers × 4 weeks = 400 emails/month (free tier ✅)
```

### Supabase
```
Database writes:
- 480 reviews/day = ~14,400/month
- ~200 incidents/month
- ~400 classification updates/month
Total: ~15,000 writes/month (free tier ✅)

Storage: Minimal (text only, ~10 MB/month)
```

## Critical Issues Before Alpha

### ❌ MISSING IMPLEMENTATIONS (P0 Blockers)
1. `scripts/backfill-trustpilot.ts` → Scraper won't run
2. `scripts/classify-unclassified-reviews.ts` → Classifier won't run
3. `scripts/run-daily-incidents.ts` → Detector won't run
4. `app/api/cron/send-weekly-reports/route.js` → Emails won't send

### ⚠️ SCHEMA VERIFICATION NEEDED
5. `user_subscriptions` table → Doesn't exist
6. `weekly_incidents` table → Verify schema matches
7. `trustpilot_reviews` → Verify has `category` + `classified_at` fields

### 🐛 BUG
8. Intelligence page shows 90 days (requirement is 30 days)

## Quick Start (After Implementation)

### Manual Trigger (Testing)
```bash
# Trigger scraper
gh workflow run sync-trustpilot-reviews.yml

# Trigger classifier
gh workflow run sync-classify-reviews.yml

# Trigger incident detector
gh workflow run run-daily-incidents.yml

# Trigger email send
gh workflow run send-weekly-reports.yml
```

### Check Status
```bash
# View workflows
gh run list

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM trustpilot_reviews WHERE classified_at IS NULL;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM weekly_incidents WHERE created_at > NOW() - INTERVAL '7 days';"

# Monitor admin dashboard
open https://your-app.vercel.app/admin/dashboard
```

## Monitoring Checklist

Daily (Automated):
- [ ] Scraper completed successfully (check GitHub Actions logs)
- [ ] Reviews classified (unclassified count < 100)
- [ ] Incidents detected (check admin dashboard)

Weekly (Monday):
- [ ] Email reports sent (check Resend logs)
- [ ] Delivery rate >95% (check admin dashboard)

Monthly:
- [ ] OpenAI costs within budget (~$155/month)
- [ ] Review classification accuracy (manual spot check)
- [ ] No error alerts triggered

---

**Last Updated:** 2025-02-14
**System Status:** ❌ NOT READY (4 critical files missing)
**Estimated Completion:** 2-3 weeks
