# Intelligence Feed System Architecture

This document describes the **intelligence feed pipeline**: daily jobs (scrape → classify → incidents) and weekly jobs (generate firm reports → send digest emails). All times are **UTC** unless noted.

---

## Schedule at a glance

| Schedule | Workflow | Time (UTC) | What it does |
|----------|----------|------------|--------------|
| **Daily** | `daily-step1-sync-firm-trustpilot-reviews.yml` | 11:00 (3 AM PST) | Scrape Trustpilot → `trustpilot_reviews` |
| **Daily** | `daily-step2-sync-firm-classify-reviews.yml` | 12:00 (4 AM PST) | Classify reviews (OpenAI) → update `trustpilot_reviews` |
| **Daily** | `daily-step3-sync-firm-incidents.yml` | 13:00 (5 AM PST) | Detect incidents → `firm_daily_incidents` |
| **Weekly** | `weekly-step1-generate-firm-weekly-reports.yml` | Sunday 07:00 | Generate reports → `firm_weekly_reports` (current week) |
| **Weekly** | `weekly-step2-send-firm-weekly-reports.yml` | Sunday 08:00 | Send digest emails (Resend) |

---

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DAILY PIPELINE (Mon–Sat, 11 / 12 / 13 UTC)         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ Trustpilot   │ (Source of Truth)
│ Website      │
└──────┬───────┘
       │
       │ Daily 3 AM PST (11:00 UTC)
       │ Workflow: daily-step1-sync-firm-trustpilot-reviews.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ DAILY STEP 1: SCRAPE                                                     │
│ scripts/backfill-firm-trustpilot-reviews.ts                              │
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
       │ Workflow: daily-step2-sync-firm-classify-reviews.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ DAILY STEP 2: CLASSIFY                                                   │
│ scripts/classify-firm-unclassified-trustpilot-reviews.ts                 │
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
       │ Workflow: daily-step3-sync-firm-incidents.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ DAILY STEP 3: DETECT INCIDENTS                                           │
│ scripts/run-firm-daily-incidents.ts                                      │
│ ├─ OpenAI: batch of 10 incidents per API call (lib/digest/incident-aggregator) │
│ ├─ Group reviews by: firm_id, current_week, category                     │
│ ├─ Threshold: ≥3 reviews = incident                                     │
│ ├─ OpenAI GPT-4: aggregate → title + summary                             │
│ ├─ Severity: high (≥10 reviews), medium (≥5), low (≥3)                   │
│ └─ Upsert to firm_daily_incidents (dedupe by firm+week+type)             │
└──────┬───────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Supabase: firm_daily_incidents                      │
│  ┌────────────────────────────────────────────┐     │
│  │ id | firm_id | year | week_number |        │     │
│  │ incident_type | severity | title |         │     │
│  │ summary | review_count | review_ids        │     │
│  └────────────────────────────────────────────┘     │
└──────┬──────────────────────────────────────────────┘
       │
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEEKLY PIPELINE (Sunday 07:00 & 08:00 UTC)                │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       │ Sunday 07:00 UTC
       │ Workflow: weekly-step1-generate-firm-weekly-reports.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ WEEKLY STEP 1: GENERATE FIRM WEEKLY REPORTS                              │
│ scripts/generate-firm-weekly-reports.ts                                  │
│ ├─ Current week (Mon–Sun UTC) per firm                                  │
│ ├─ payouts + trustpilot_reviews + firm_daily_incidents + AI "Our Take"   │
│ └─ UPSERT firm_weekly_reports (week_from_date, week_to_date, report_json)│
└──────┬───────────────────────────────────────────────────────────────────┘
       │
       │ Sunday 08:00 UTC
       │ Workflow: weekly-step2-send-firm-weekly-reports.yml
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ WEEKLY STEP 2: SEND DIGEST EMAILS                                        │
│ GET /api/cron/send-weekly-reports                                        │
│ ├─ Query: user_subscriptions WHERE email_enabled = true                  │
│ ├─ For each user: firm_weekly_reports (report_json) for subscribed firms │
│ │   (current week: week_from_date / week_to_date)                        │
│ ├─ sendWeeklyDigest(user, reports[], options) → HTML + Resend            │
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
                              │  ├─ firm_daily_incidents │
                              │  ├─ firm_weekly_reports  │
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

### Daily jobs (3 AM, 4 AM, 5 AM PST = 11:00, 12:00, 13:00 UTC)

**1. SCRAPE** — `daily-step1-sync-firm-trustpilot-reviews.yml`
```
Trustpilot → Playwright → trustpilot_reviews (raw, unclassified)
```

**2. CLASSIFY** — `daily-step2-sync-firm-classify-reviews.yml`
```
trustpilot_reviews (WHERE classified_at IS NULL)
  → OpenAI GPT-4
  → UPDATE category, classified_at
```

**3. DETECT INCIDENTS** — `daily-step3-sync-firm-incidents.yml`
```
trustpilot_reviews (current week, grouped by category)
  → Aggregate + threshold check (≥3 reviews)
  → OpenAI GPT-4 (generate title + summary)
  → UPSERT firm_daily_incidents
```

### Weekly jobs (Sunday 07:00 and 08:00 UTC)

**4. GENERATE FIRM WEEKLY REPORTS** — `weekly-step1-generate-firm-weekly-reports.yml`
```
scripts/generate-firm-weekly-reports.ts
  → Current week (Mon–Sun UTC) per firm
  → payouts + trustpilot_reviews + firm_daily_incidents + AI "Our Take"
  → UPSERT firm_weekly_reports (week_from_date, week_to_date, report_json)
  → Persist run to cron_last_run (admin dashboard monitoring)
```

**5. SEND DIGEST EMAILS** — `weekly-step2-send-firm-weekly-reports.yml`
```
user_subscriptions (email_enabled = true)
  → Group by user_id → list of firm_ids per user
  → firm_weekly_reports (report_json, current week, for those firm_ids)
  → For each user: only reports for firms they subscribe to
  → sendWeeklyDigest(user, reports[], options) → HTML + Resend → User inbox
  → Persist run to cron_last_run (admin dashboard monitoring)
```

### Real-time (UI / API)

**6. RENDER**
```
firm_daily_incidents (last N days, default 90)
  → API: /api/v2/propfirms/[id]/incidents?days=30
  → UI: /propfirms/[id]/intelligence
  → User browser
```

## firm_weekly_reports vs firm_daily_incidents

| Table | Purpose | Grain | Used by |
|-------|---------|--------|---------|
| **firm_daily_incidents** | One row per detected incident (e.g. “payout delays” from ≥3 reviews). Data is updated **daily**. | Many rows per firm per week (0 to N incidents). | UI incidents API; also consumed by report generator. |
| **firm_weekly_reports** | One cached “full report” per firm per **week** (payouts + Trustpilot + incidents + “Our Take”). | One row per (firm_id, week_from_date). `report_json` holds the full snapshot. | Weekly Step 2: reads `report_json` to build each user’s digest email. |

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
  firm_daily_incidents   firm_weekly_reports
  (many rows per         (one row per firm/week;
   firm/week; daily)      weekly; used by weekly-step2-send)
```

- **firm_daily_incidents**: written by **daily** step 3 (`scripts/run-firm-daily-incidents.ts`); each row = one incident (type, severity, title, summary). APIs and UI query this for “last N days” incidents.
- **firm_weekly_reports**: written by **weekly** step 1 (`scripts/generate-firm-weekly-reports.ts` → `lib/digest/generator.ts` → `generateWeeklyReport()`). Runs every **Sunday 7:00 UTC**. Holds the **current week** (Mon–Sun UTC) snapshot per firm. **Weekly Step 2** (Sunday 8:00 UTC) uses `firm_weekly_reports.report_json` to send one digest email per user with payouts + Trustpilot + incidents + ourTake for **their subscribed firms only** (see [Weekly email flow and per-user customization](#weekly-email-flow-and-per-user-customization) below).

### Weekly email flow and per-user customization

**Weekly Step 2** (`weekly-step2-send-firm-weekly-reports.yml`) runs every **Sunday 8:00 UTC**. It sends **one digest email per user**; the **content of each email is customized** to only include reports for the firms that user is subscribed to.

**Flow:**

```
1. Compute current week (Mon–Sun UTC) — same week Weekly Step 1 wrote to firm_weekly_reports.

2. Load user_subscriptions WHERE email_enabled = true
   → List of (user_id, firm_id). Group by user_id → each user has a set of firm_ids.

3. Load profiles (id, email) for those user_ids
   → Map user_id → email (skip users with no email).

4. Load firm_weekly_reports for current week for ALL firm_ids that appear in any subscription
   → Query by (firm_id IN (...), week_from_date, week_to_date). Map firm_id → report_json.

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
| Carol | fundingpips, the5ers, fxify | One email: up to 3 sections (only firms that have a report for the current week). |

- **Filtering:** The digest API never sends a report for a firm the user is not subscribed to. It looks up `user_subscriptions` for that user and only includes `report_json` for those `firm_id`s.
- **Skipped:** If a user has email enabled but none of their subscribed firms have a row in `firm_weekly_reports` for the current week (e.g. Weekly Step 1 failed or didn’t run), that user gets **no email** and is counted as "skipped".
- **Monitoring:** Last run time, `sent`, `failed`, `skipped`, and sample `errors` are stored in `cron_last_run` (job_name: `send_weekly_reports`) and shown on the admin dashboard (Weekly Step 2 tab).

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

### firm_weekly_reports
One row per (firm_id, week_from_date). Cached output of the report generator; used by **Weekly Step 2** (digest send). Week is stored as **dates** (Mon–Sun UTC), not week_number/year.
```sql
┌─────────────────┬──────────────┬─────────────────────────┐
│ Field           │ Type         │ Description             │
├─────────────────┼──────────────┼─────────────────────────┤
│ id              │ SERIAL       │ Primary key             │
│ firm_id         │ TEXT         │ FK firms(id)            │
│ week_from_date  │ DATE         │ Monday (week start)     │
│ week_to_date    │ DATE         │ Sunday (week end)       │
│ report_json     │ JSONB        │ payouts, trustpilot,    │
│                 │              │ incidents[], ourTake    │
│ generated_at    │ TIMESTAMPTZ  │ When generated          │
├─────────────────┴──────────────┴─────────────────────────┤
│ UNIQUE (firm_id, week_from_date)                           │
└───────────────────────────────────────────────────────────┘
```
Populated by `lib/digest/generator.ts` → `generateWeeklyReport()`. Read by `GET /api/cron/send-weekly-reports` to build digest emails.

#### How the weekly report is generated and how email is sent

- **Report generation:** `lib/digest/generator.ts` exposes `generateWeeklyReport(firmId, weekStart, weekEnd)`. It loads payout data (from JSON), Trustpilot reviews, and incidents for that firm/week, builds payouts summary, Trustpilot summary, incidents list, and an AI “Our Take” section, then upserts one row per (firm, week) into `firm_weekly_reports`. **Weekly Step 1** (`weekly-step1-generate-firm-weekly-reports.yml`) runs every **Sunday 7:00 UTC** for the **current week** (Mon–Sun UTC). Results are stored in `cron_last_run` for the admin dashboard.
- **Email send:** Every **Sunday 8:00 UTC**, **Weekly Step 2** (`weekly-step2-send-firm-weekly-reports.yml`) calls `GET /api/cron/send-weekly-reports` (auth: `Authorization: Bearer CRON_SECRET`). The route: (1) computes current week (Mon–Sun) in UTC; (2) loads `user_subscriptions` with `email_enabled = true` and groups by `user_id` → list of `firm_id`s; (3) loads user emails from `profiles`; (4) loads `firm_weekly_reports` for the current week for those firms; (5) for each user with email and at least one report, calls `sendWeeklyDigest(user, reports, { weekStart, weekEnd, baseUrl })` in `lib/email/send-digest.ts`, which builds HTML and sends via Resend (`lib/resend.ts`). Response and run summary are stored in `cron_last_run` for admin dashboard monitoring. See [Weekly email flow and per-user customization](#weekly-email-flow-and-per-user-customization) above.
- **Testing:** `app/api/cron/send-weekly-reports/route.test.js` covers auth, no subscribers, with subscribers + mock `sendWeeklyDigest`, and error paths. `lib/email/__tests__/send-digest.test.ts` mocks Resend and asserts `sendWeeklyDigest` success/failure and call args.

### firm_daily_incidents
Many rows per firm per week (0 or more). One row = one detected incident (e.g. “payout delays” from ≥3 reviews). **Updated daily** by Daily Step 3.
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
Written by **Daily Step 3** (`scripts/run-firm-daily-incidents.ts`). Read by UI/API (`/api/v2/propfirms/[id]/incidents`) and by the report generator (to embed in `firm_weekly_reports.report_json`).

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

All workflow **filenames** follow: **daily-stepN-…** for daily jobs, **weekly-stepN-…** for weekly jobs.

### Daily workflows

**1. daily-step1-sync-firm-trustpilot-reviews.yml**
```yaml
Schedule: Daily
Cron: 0 11 * * *  (3 AM PST / 11:00 UTC)
Runs: npx tsx scripts/backfill-firm-trustpilot-reviews.ts
Env:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

**2. daily-step2-sync-firm-classify-reviews.yml**
```yaml
Schedule: Daily
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
| `scripts/classify-firm-unclassified-trustpilot-reviews.ts` | Cron entry point (daily-step2-sync-firm-classify-reviews.yml). Uses `classifyReviewBatch`; supports MAX_PER_RUN, delay. | 20 (env override) |

**3. daily-step3-sync-firm-incidents.yml**
```yaml
Schedule: Daily
Cron: 0 13 * * *  (5 AM PST / 13:00 UTC)
Runs: npx tsx scripts/run-firm-daily-incidents.ts
Env:  OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### Weekly workflows

**4. weekly-step1-generate-firm-weekly-reports.yml**
```yaml
Schedule: Weekly (Sunday)
Cron: 0 7 * * 0  (Sunday 07:00 UTC)
Runs: npx tsx scripts/generate-firm-weekly-reports.ts
Env:  OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```
Populates `firm_weekly_reports` for the **current week** (Mon–Sun UTC). Results stored in `cron_last_run` (job: generate_weekly_reports). Admin dashboard shows last run, firms processed, success/error counts.

**5. weekly-step2-send-firm-weekly-reports.yml**
```yaml
Schedule: Weekly (Sunday)
Cron: 0 8 * * 0  (Sunday 08:00 UTC)
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
Used by: GitHub Actions weekly-step2-send-firm-weekly-reports (weekly)
```

## File Locations

```
Code:
├── lib/scrapers/trustpilot.ts                           ✅ EXISTS
├── scripts/backfill-firm-trustpilot-reviews.ts          ✅ EXISTS (daily step 1)
├── scripts/classify-firm-unclassified-trustpilot-reviews.ts  ✅ EXISTS (daily step 2, batch 20)
├── scripts/run-firm-daily-incidents.ts                  ✅ EXISTS (daily step 3, batch 10 incidents/call)
├── scripts/generate-firm-weekly-reports.ts              ✅ EXISTS (weekly step 1)
├── app/api/cron/send-weekly-reports/route.js            ✅ EXISTS (weekly step 2, GET)
├── app/propfirms/[id]/page.js                           ✅ EXISTS (intelligence section)
├── app/propfirms/[id]/intelligence/page.js              ✅ EXISTS
└── components/propfirms/intelligence/
    ├── IntelligenceCard.js                             ✅ EXISTS
    └── IntelligenceCardSkeleton.js                      ✅ EXISTS

Database (see migrations/README.md):
├── trustpilot_reviews, user_subscriptions               ✅
├── firm_daily_incidents (was weekly_incidents)           ✅ migration 22
└── firm_weekly_reports (week_from_date, week_to_date)    ✅ migration 22

Workflows (daily = 11/12/13 UTC; weekly = Sunday 07:00, 08:00 UTC):
├── .github/workflows/daily-step1-sync-firm-trustpilot-reviews.yml   ✅
├── .github/workflows/daily-step2-sync-firm-classify-reviews.yml     ✅
├── .github/workflows/daily-step3-sync-firm-incidents.yml            ✅
├── .github/workflows/weekly-step1-generate-firm-weekly-reports.yml  ✅
└── .github/workflows/weekly-step2-send-firm-weekly-reports.yml      ✅
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

## Verification checklist

- **Daily workflows:** step1 (scrape), step2 (classify), step3 (incidents) run at 11:00, 12:00, 13:00 UTC. Scripts and workflows exist.
- **Weekly workflows:** step1 (generate reports) Sunday 07:00 UTC, step2 (send emails) Sunday 08:00 UTC. Scripts and API exist.
- **Tables:** `trustpilot_reviews`, `firm_daily_incidents`, `firm_weekly_reports`, `user_subscriptions`. See `migrations/README.md` and migration 22 for firm_* schema.
- **Optional:** Intelligence page default `days` (API allows 1–365; UI may show 90).

## Quick Start

### Manual trigger (testing)
```bash
# Daily jobs
gh workflow run daily-step1-sync-firm-trustpilot-reviews.yml
gh workflow run daily-step2-sync-firm-classify-reviews.yml
gh workflow run daily-step3-sync-firm-incidents.yml

# Weekly jobs (run Step 1 before Step 2 so reports exist)
gh workflow run weekly-step1-generate-firm-weekly-reports.yml
gh workflow run weekly-step2-send-firm-weekly-reports.yml
```

### Check status
```bash
# View workflow runs
gh run list

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM trustpilot_reviews WHERE classified_at IS NULL;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM firm_daily_incidents WHERE created_at > NOW() - INTERVAL '7 days';"

# Admin dashboard (pipeline metrics, last run per job)
open https://your-app.vercel.app/admin/dashboard
```

## Monitoring checklist

**Daily (automated):**
- [ ] Scraper completed (daily-step1; GitHub Actions logs)
- [ ] Reviews classified (unclassified count < 100; daily-step2)
- [ ] Incidents detected (daily-step3; admin dashboard)

**Weekly (Sunday):**
- [ ] Firm weekly reports generated (weekly-step1; cron_last_run)
- [ ] Digest emails sent (weekly-step2; Resend logs, admin dashboard)
- [ ] Delivery rate >95%

**Monthly:**
- [ ] OpenAI costs within budget (~$155/month)
- [ ] Review classification accuracy (manual spot check)
- [ ] No error alerts triggered

---

**Last updated:** 2026-02-15  
**Naming:** Daily jobs = `daily-step1-…`, `daily-step2-…`, `daily-step3-…`. Weekly jobs = `weekly-step1-…`, `weekly-step2-…`. Tables = `firm_daily_incidents`, `firm_weekly_reports`. All times UTC.
