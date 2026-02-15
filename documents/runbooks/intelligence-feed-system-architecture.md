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
       │ GitHub Actions: step1-sync-trustpilot-reviews-daily.yml (daily)
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 1: SCRAPE                                                           │
│ scripts/backfill-firm-trustpilot-reviews.ts (MISSING ❌)                             │
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
       │ GitHub Actions: step2-sync-classify-reviews-daily.yml (daily)
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 2: CLASSIFY                                                         │
│ scripts/classify-firm-unclassified-trustpilot-reviews.ts                                │
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
       │ GitHub Actions: step3-run-daily-incidents-daily.yml (daily)
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ STEP 3: DETECT INCIDENTS                                                 │
│ scripts/run-firm-daily-incidents.ts                                          │
│ ├─ OpenAI: batch of 10 incidents per API call (lib/digest/incident-aggregator) │
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
       │ Weekly Monday 13:30 UTC
       │ GitHub Actions: step3b-generate-weekly-reports-weekly.yml (weekly)
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

### 3b. GENERATE REPORTS (Weekly Monday 13:30 UTC)
```
scripts/generate-firm-weekly-reports.ts
  → For each firm: generateWeeklyReport(firmId, lastWeekStart, lastWeekEnd)
  → payouts + trustpilot_reviews + weekly_incidents + AI "Our Take"
  → UPSERT weekly_reports (one row per firm/week)
  → Persist run to cron_last_run (admin dashboard monitoring)
```

### 4. EMAIL (Weekly Monday 14:00 UTC)
```
user_subscriptions (email_enabled = true)
  → Group by user_id → list of firm_ids per user
  → weekly_reports (report_json, last week, for those firm_ids)
  → For each user: only reports for firms they subscribe to
  → sendWeeklyDigest(user, reports[], options) → HTML + Resend → User inbox
  → Persist run to cron_last_run (admin dashboard monitoring)
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
- **firm_weekly_reports**: written by **Step 3b** (`scripts/generate-firm-weekly-reports.ts` → `lib/digest/generator.ts` → `generateWeeklyReport()`). Runs every Sunday 7:00 UTC. Holds the current week (Mon–Sun UTC) snapshot per firm. The **weekly email (Step 4)** uses `firm_weekly_reports.report_json` so each user gets one email with payouts + Trustpilot + incidents + ourTake for **their subscribed firms only** (see [Weekly email flow and per-user customization](#weekly-email-flow-and-per-user-customization) below).

### Weekly email flow and per-user customization

Step 4 (send-weekly-reports) runs every **Monday 14:00 UTC**. It sends **one digest email per user**; the **content of each email is customized** to only include weekly reports for the firms that user is subscribed to.

**Flow:**

```
1. Compute "last week" (Mon–Sun UTC) — same week Step 3b wrote to weekly_reports.

2. Load user_subscriptions WHERE email_enabled = true
   → List of (user_id, firm_id). Group by user_id → each user has a set of firm_ids.

3. Load profiles (id, email) for those user_ids
   → Map user_id → email (skip users with no email).

4. Load weekly_reports for last week for ALL firm_ids that appear in any subscription
   → One query: (firm_id IN (...), week_number = X, year = Y). Map firm_id → report_json.

5. For each user:
   - Get their firm_ids from step 2.
   - Collect report_json for those firm_ids from step 4 (only firms they subscribe to).
   - If reports.length === 0 → skip (no email; user is "skipped").
   - If reports.length >= 1 → build one HTML digest with those reports only, send via Resend.
```

**How users get customized emails:**

| User  | Subscriptions (firm_id)     | Email content                                      |
|-------|------------------------------|----------------------------------------------------|
| Alice | fundingpips, the5ers        | One email: 2 sections (FundingPips + The5ers).    |
| Bob   | fundingpips                  | One email: 1 section (FundingPips only).          |
| Carol | fundingpips, the5ers, fxify | One email: up to 3 sections (only firms that have a report for last week). |

- **Filtering:** The digest API never sends a report for a firm the user is not subscribed to. It looks up `user_subscriptions` for that user and only includes `report_json` for those `firm_id`s.
- **Skipped:** If a user has email enabled but none of their subscribed firms have a row in `weekly_reports` for last week (e.g. Step 3b failed or didn’t run), that user gets **no email** and is counted as "skipped".
- **Monitoring:** Last run time, `sent`, `failed`, `skipped`, and sample `errors` are stored in `cron_last_run` (job_name: `send_weekly_reports`) and shown on the admin dashboard (Step 4 tab).

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

#### How weekly report is generated and how email is sent

- **Report generation:** `lib/digest/generator.ts` exposes `generateWeeklyReport(firmId, weekStart, weekEnd)`. It loads payout data (from JSON), Trustpilot reviews, and incidents for that firm/week, builds payouts summary, Trustpilot summary, incidents list, and an AI “Our Take” section, then upserts one row per (firm, week) into `weekly_reports`. Step 3b (step3b-generate-weekly-reports-weekly.yml, Monday 13:30 UTC) runs it for “last week” before the send cron (e.g. Monday morning).
- **Email send:** Every Monday 14:00 UTC, GitHub Actions runs `step4-send-weekly-reports-weekly.yml`, which calls `GET /api/cron/send-weekly-reports` (auth: `Authorization: Bearer CRON_SECRET`). The route: (1) computes last week (Mon–Sun) in UTC; (2) loads `user_subscriptions` with `email_enabled = true` and groups by `user_id` → list of `firm_id`s; (3) loads user emails from `profiles`; (4) loads `weekly_reports` for last week for those firms; (5) for each user with email and at least one report, calls `sendWeeklyDigest(user, reports, { weekStart, weekEnd, baseUrl })` in `lib/email/send-digest.ts`, which builds HTML and sends via Resend (`lib/resend.ts`). Response and run summary are stored in `cron_last_run` for admin dashboard monitoring. See [Weekly email flow and per-user customization](#weekly-email-flow-and-per-user-customization) below.
- **Testing:** `app/api/cron/send-weekly-reports/route.test.js` covers auth, no subscribers, with subscribers + mock `sendWeeklyDigest`, and error paths. `lib/email/__tests__/send-digest.test.ts` mocks Resend and asserts `sendWeeklyDigest` success/failure and call args.

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

### 1. step1-sync-trustpilot-reviews-daily.yml (daily)
```yaml
Cron: 0 11 * * *  (3 AM PST / 11:00 UTC)
Runs: npx tsx scripts/backfill-firm-trustpilot-reviews.ts
Env:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### 2. step2-sync-classify-reviews-daily.yml (daily)
```yaml
Cron: 0 12 * * *  (4 AM PST / 12:00 UTC)
Runs: npx tsx scripts/classify-firm-unclassified-trustpilot-reviews.ts
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
| `scripts/classify-firm-unclassified-trustpilot-reviews.ts` | Cron entry point (step2-sync-classify-reviews-daily.yml). Uses `classifyReviewBatch`; supports MAX_PER_RUN, delay. | 20 (env override) |

### 3. run-daily-incidents.yml
```yaml
Cron: 0 13 * * *  (5 AM PST / 13:00 UTC)
Runs: npx tsx scripts/run-firm-daily-incidents.ts
Env:  OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### 3b. step3b-generate-weekly-reports-weekly.yml (weekly)
```yaml
Cron: 30 13 * * 1  (Monday 13:30 UTC)
Runs: npx tsx scripts/generate-firm-weekly-reports.ts
Env:  OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```
Populates `weekly_reports` for last week. Results stored in `cron_last_run` (job: generate_weekly_reports). Admin dashboard shows last run, firms processed, success/error counts.

### 4. step4-send-weekly-reports-weekly.yml (weekly)
```yaml
Cron: 0 14 * * 1  (Monday 14:00 UTC)
Runs: curl -H "Authorization: Bearer $CRON_SECRET" $SITE_URL/api/cron/send-weekly-reports
Env:  CRON_SECRET, SITE_URL
```
Sends digest emails via Resend. Results stored in `cron_last_run` (job: send_weekly_reports). Admin dashboard shows last run, sent/failed/skipped, errors.

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

### GET /api/cron/send-weekly-reports
```
Auth: Bearer $CRON_SECRET
Returns: { sent: N, failed: M, skipped: K, errors: [...], weekStart, weekEnd, durationMs }
Used by: GitHub Actions step4-send-weekly-reports-weekly (weekly)
```

## File Locations

```
Code:
├── lib/scrapers/trustpilot.ts           ✅ EXISTS
├── scripts/backfill-firm-trustpilot-reviews.ts       ❌ MISSING
├── scripts/classify-firm-unclassified-trustpilot-reviews.ts  ✅ EXISTS (batch size 20)
├── scripts/run-firm-daily-incidents.ts       ✅ EXISTS (batch 10 incidents/call)
├── scripts/generate-firm-weekly-reports.ts  ✅ EXISTS (Step 3b, weekly)
├── app/api/cron/send-weekly-reports/route.js    ✅ EXISTS (Step 4, GET)
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
├── .github/workflows/step1-sync-trustpilot-reviews-daily.yml   ✅ EXISTS
├── .github/workflows/step2-sync-classify-reviews-daily.yml     ✅ EXISTS
├── .github/workflows/step3-run-daily-incidents-daily.yml       ✅ EXISTS
└── .github/workflows/step4-send-weekly-reports-weekly.yml      ✅ EXISTS
```

## Environment Variables

**Local runs:** Put keys in **`.env`** at project root. Scripts (e.g. `backfill-firm-trustpilot-reviews.ts`) load `.env` via `dotenv/config`—do not `export` vars in the shell.

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
1. `scripts/backfill-firm-trustpilot-reviews.ts` → Scraper won't run
2. `scripts/classify-firm-unclassified-trustpilot-reviews.ts` → Classifier won't run
3. `scripts/run-firm-daily-incidents.ts` → Detector won't run
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
gh workflow run step1-sync-trustpilot-reviews-daily.yml

# Trigger classifier
gh workflow run step2-sync-classify-reviews-daily.yml

# Trigger incident detector
gh workflow run step3-run-daily-incidents-daily.yml

# Trigger email send
gh workflow run step4-send-weekly-reports-weekly.yml
```

### Check Status
```bash
# View workflows
gh run list

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM trustpilot_reviews WHERE classified_at IS NULL;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM weekly_incidents WHERE created_at > NOW() - INTERVAL '7 days';"

# Monitor admin dashboard (includes: review classification, incident detection per-firm this week, Trustpilot scraper, intelligence feed)
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
