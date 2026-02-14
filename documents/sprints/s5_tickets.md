# Intelligence Feed System - Sprint Tickets

**Sprint Goal:** Complete Alpha release of Intelligence Feed system with full async pipeline, UI, and weekly email reports.

**Story Points:** Based on Fibonacci scale (1, 2, 3, 5, 8, 13)

---

## Epic 1: Async Data Pipeline (Backend)

### TICKET-001: Create Trustpilot Backfill Script 🔴 CRITICAL

**Status:** Not Started
**Priority:** P0 (Blocker)
**Story Points:** 3
**Assignee:** Backend Engineer

**Description:**

Create the missing `scripts/backfill-trustpilot.ts` script that the GitHub Actions workflow calls daily to scrape Trustpilot reviews for all supported prop firms.

**Acceptance Criteria:**

- [ ] File created at `scripts/backfill-trustpilot.ts`
- [ ] Script imports `scrapeAndStoreReviews` from `lib/scrapers/trustpilot.ts`
- [ ] Script imports `TRUSTPILOT_FIRM_IDS` constant (or defines list)
- [ ] Loops through all 8 supported firms: `fundednext, the5ers, fundingpips, alphacapitalgroup, blueguardian, aquafunded, instantfunding, fxify`
- [ ] Calls `scrapeAndStoreReviews(firmId, config)` with:
  - `maxPages: 3` (from env `TRUSTPILOT_BACKFILL_PAGES`)
  - `maxReviews: 50` (from env `TRUSTPILOT_MAX_REVIEWS`)
- [ ] Logs progress: `[Firm X/8] Scraping ${firmId}...`
- [ ] Logs results: `Scraped ${result.reviewsScraped}, stored ${result.reviewsStored}, skipped ${result.duplicatesSkipped} duplicates`
- [ ] Exits with code 0 on success, 1 on any firm failure
- [ ] Total execution time < 15 minutes (GitHub Actions timeout)

**Implementation Notes:**

```typescript
// scripts/backfill-trustpilot.ts
import { scrapeAndStoreReviews, TRUSTPILOT_FIRM_IDS } from '@/lib/scrapers/trustpilot';

const config = {
  maxPages: parseInt(process.env.TRUSTPILOT_BACKFILL_PAGES || '3'),
  maxReviews: parseInt(process.env.TRUSTPILOT_MAX_REVIEWS || '50'),
  headless: true,
};

async function main() {
  console.log(`[Trustpilot Backfill] Starting scrape for ${TRUSTPILOT_FIRM_IDS.length} firms`);

  for (let i = 0; i < TRUSTPILOT_FIRM_IDS.length; i++) {
    const firmId = TRUSTPILOT_FIRM_IDS[i];
    console.log(`[Firm ${i+1}/${TRUSTPILOT_FIRM_IDS.length}] Scraping ${firmId}...`);

    const result = await scrapeAndStoreReviews(firmId, config);

    if (!result.success) {
      console.error(`[${firmId}] Failed: ${result.error}`);
      process.exit(1);
    }

    console.log(`[${firmId}] Scraped ${result.reviewsScraped}, stored ${result.reviewsStored}, skipped ${result.duplicatesSkipped} duplicates`);
  }

  console.log('[Trustpilot Backfill] Completed successfully');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

**Testing:**

- [ ] Run locally: `TRUSTPILOT_BACKFILL_PAGES=1 npx tsx scripts/backfill-trustpilot.ts`
- [ ] Verify reviews inserted into `trustpilot_reviews` table
- [ ] Check duplicate handling: re-run should skip existing reviews
- [ ] Manually trigger GitHub Actions workflow `sync-trustpilot-reviews.yml`
- [ ] Check Actions logs for successful completion

**Dependencies:**

- `lib/scrapers/trustpilot.ts` (exists ✅)
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars
- Supabase `trustpilot_reviews` table

**Files Changed:**

- `scripts/backfill-trustpilot.ts` (new)

---

### TICKET-002: Create Review Classification Script 🔴 CRITICAL

**Status:** Not Started
**Priority:** P0 (Blocker)
**Story Points:** 8
**Assignee:** Backend Engineer + ML Engineer

**Description:**

Create `scripts/classify-unclassified-reviews.ts` to classify Trustpilot reviews using OpenAI GPT-4. This script queries unclassified reviews from the database and updates their `category` field based on sentiment and incident type.

**Acceptance Criteria:**

- [ ] File created at `scripts/classify-unclassified-reviews.ts`
- [ ] Query `trustpilot_reviews` WHERE `classified_at IS NULL`
- [ ] Batch process reviews (e.g., 50 at a time) to respect OpenAI rate limits
- [ ] For each review, call OpenAI GPT-4 (gpt-4-turbo-preview or gpt-4o):
  - Input: `{ rating, title, review_text }`
  - Output: `{ category: string }` (one of 20+ valid categories)
- [ ] Update review with `category` and `classified_at = NOW()`
- [ ] Handle errors gracefully:
  - OpenAI API failure → Log error, skip review, continue
  - Rate limit → Exponential backoff retry
  - Invalid category → Default to "other"
- [ ] Logging:
  - Total unclassified reviews found
  - Batch progress: `Classified 50/500 reviews...`
  - Final summary: `{ total: 500, classified: 485, failed: 15 }`
- [ ] Exit code 0 on success, 1 if >50% failures

**Valid Categories:**

```typescript
// Operational issues
'platform_technical_issue',
'support_issue',
'payout_delay',
'payout_denied',
'kyc_withdrawal_issue',
'execution_conditions',

// Reputation issues
'high_risk_allegation',
'scam_warning',
'rules_dispute',
'pricing_fee_complaint',
'payout_issue',
'platform_issue',
'rule_violation',
'other',

// Positive/Neutral
'positive_experience',
'positive',
'neutral_mixed',
'neutral'
```

**OpenAI Prompt Template:**

```typescript
const prompt = `Classify the following Trustpilot review into one category.

Review:
Title: ${review.title || 'N/A'}
Rating: ${review.rating}/5
Text: ${review.review_text}

Categories:
- platform_technical_issue: Technical problems with the trading platform (crashes, login issues, API failures)
- support_issue: Poor customer support, unresponsive staff, language barriers
- payout_delay: Delayed withdrawals but eventually paid
- payout_denied: Withdrawal denied or blocked
- kyc_withdrawal_issue: KYC verification problems blocking withdrawals
- execution_conditions: Order execution quality, slippage, spreads
- high_risk_allegation: Accusations of fraud, market manipulation
- scam_warning: Claims of scam, theft, or deception
- rules_dispute: Disagreements over trading rules or terms
- pricing_fee_complaint: Complaints about fees or pricing
- payout_issue: General payout problems (not delay or denial)
- platform_issue: General platform complaints (not technical)
- rule_violation: Firm claiming trader broke rules
- positive_experience: Positive feedback, satisfaction
- positive: General positive sentiment
- neutral_mixed: Mixed or neutral feedback
- neutral: Neutral statement
- other: Doesn't fit other categories

Output ONLY the category name, no explanation.`;
```

**Implementation Sketch:**

```typescript
import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase/service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createServiceClient();

const BATCH_SIZE = 50;

async function classifyReview(review) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: /* prompt */ }],
    temperature: 0.3,
    max_tokens: 50,
  });

  const category = response.choices[0].message.content.trim();
  return VALID_CATEGORIES.includes(category) ? category : 'other';
}

async function main() {
  const { data: reviews } = await supabase
    .from('trustpilot_reviews')
    .select('id, rating, title, review_text')
    .is('classified_at', null)
    .limit(1000); // Process max 1000 per run

  for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
    const batch = reviews.slice(i, i + BATCH_SIZE);
    // Process batch with rate limiting...
  }
}
```

**Testing:**

- [ ] Create test reviews in DB with `classified_at = NULL`
- [ ] Run script: `OPENAI_API_KEY=xxx npx tsx scripts/classify-unclassified-reviews.ts`
- [ ] Verify `category` field updated correctly
- [ ] Test error handling: invalid OpenAI key → should log error and exit 1
- [ ] Test rate limiting: Process 100+ reviews → should throttle requests
- [ ] Manually trigger GitHub Actions workflow `sync-classify-reviews.yml`

**Dependencies:**

- `openai` npm package (install if missing)
- `OPENAI_API_KEY` environment variable
- Supabase `trustpilot_reviews` table with `category` and `classified_at` fields

**Cost Estimate:**

- GPT-4-turbo: ~$0.01 per review (assuming 500 input + 10 output tokens)
- Daily 60 reviews/firm × 8 firms = 480 reviews = ~$5/day

**Files Changed:**

- `scripts/classify-unclassified-reviews.ts` (new)
- `package.json` (add `openai` if missing)

---

### TICKET-003: Create Incident Detection Script 🔴 CRITICAL

**Status:** Not Started
**Priority:** P0 (Blocker)
**Story Points:** 13
**Assignee:** Backend Engineer + Data Engineer

**Description:**

Create `scripts/run-daily-incidents.ts` to aggregate classified reviews by week and detect incidents. This script runs daily to analyze the current week's reviews and create/update incident records.

**Acceptance Criteria:**

- [ ] File created at `scripts/run-daily-incidents.ts`
- [ ] For each firm in `TRUSTPILOT_FIRM_IDS`:
  1. [ ] Calculate current ISO week number and year
  2. [ ] Query `trustpilot_reviews` for current week:
     - WHERE `firm_id = X`
     - AND `review_date >= week_start_date`
     - AND `review_date < week_end_date`
     - AND `category IS NOT NULL`
  3. [ ] Group reviews by `category`
  4. [ ] For each category, detect if incident threshold met:
     - **High severity:** ≥10 reviews OR avg rating ≤2.0
     - **Medium severity:** ≥5 reviews OR avg rating ≤3.0
     - **Low severity:** ≥3 reviews
  5. [ ] If incident detected:
     - [ ] Generate `title` using OpenAI (max 80 chars)
     - [ ] Generate `summary` using OpenAI (max 300 chars, aggregate review texts)
     - [ ] Extract `review_ids` (array of up to 10 review IDs for source links)
     - [ ] Calculate `review_count` (total reviews in category)
     - [ ] Set `affected_users` = review_count (estimate)
  6. [ ] Upsert to `weekly_incidents` table:
     ```sql
     INSERT INTO weekly_incidents (firm_id, year, week_number, incident_type, severity, title, summary, review_count, affected_users, review_ids)
     VALUES (...)
     ON CONFLICT (firm_id, year, week_number, incident_type)
     DO UPDATE SET severity = EXCLUDED.severity, title = EXCLUDED.title, summary = EXCLUDED.summary, review_count = EXCLUDED.review_count, review_ids = EXCLUDED.review_ids
     ```
- [ ] Logging:
  - `[Firm X/8] Processing ${firmId}, week ${year}-W${week}`
  - `Detected ${incidents.length} incidents`
  - `Upserted incident: ${incident_type} (${severity})`
- [ ] Exit code 0 on success, 1 on failure

**ISO Week Calculation:**

```typescript
function getCurrentISOWeek() {
  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfWeek = startOfYear.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const week1Monday = new Date(Date.UTC(now.getUTCFullYear(), 0, 1 - mondayOffset));

  const daysSinceWeek1 = Math.floor((now.getTime() - week1Monday.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysSinceWeek1 / 7) + 1;

  return { year: now.getUTCFullYear(), week: weekNumber };
}
```

**OpenAI Prompt for Title:**

```typescript
const titlePrompt = `Generate a concise incident title (max 80 characters) for the following ${reviews.length} reviews:

${reviews.map(r => r.review_text.slice(0, 200)).join('\n---\n')}

Category: ${incident_type}
Severity: ${severity}

Title should be professional, specific, and action-oriented. No quotes.`;
```

**OpenAI Prompt for Summary:**

```typescript
const summaryPrompt = `Summarize the following ${reviews.length} reviews into a 2-3 sentence summary (max 300 chars):

${reviews.map(r => `Rating: ${r.rating}/5\n${r.review_text}`).join('\n---\n')}

Focus on the main issue, impact on users, and frequency. Professional tone.`;
```

**Testing:**

- [ ] Manually insert test reviews for current week into DB
- [ ] Run script: `OPENAI_API_KEY=xxx npx tsx scripts/run-daily-incidents.ts`
- [ ] Verify `weekly_incidents` table populated
- [ ] Re-run script → should UPDATE existing incidents, not duplicate
- [ ] Test edge case: No incidents for week → No inserts, log "No incidents detected"
- [ ] Manually trigger GitHub Actions workflow `run-daily-incidents.yml`

**Dependencies:**

- `scripts/classify-unclassified-reviews.ts` must run first (reviews must be classified)
- `weekly_incidents` table with unique constraint on `(firm_id, year, week_number, incident_type)`
- `OPENAI_API_KEY` environment variable

**Files Changed:**

- `scripts/run-daily-incidents.ts` (new)

---

### TICKET-004: Create Weekly Email Reports API Route 🔴 CRITICAL

**Status:** Not Started
**Priority:** P0 (Blocker)
**Story Points:** 13
**Assignee:** Full-stack Engineer

**Description:**

Create `app/api/cron/send-weekly-reports/route.js` to query subscribed users and send weekly digest emails with intelligence feed updates for their subscribed firms.

**Acceptance Criteria:**

- [ ] File created at `app/api/cron/send-weekly-reports/route.js`
- [ ] Authenticate with `CRON_SECRET`:
  ```javascript
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  ```
- [ ] Query active subscribers:
  ```javascript
  const { data: subs } = await supabase
    .from('user_subscriptions')
    .select('user_id, email, firm_id')
    .eq('active', true);
  ```
- [ ] Group subscribers by email (one email per user with multiple firms)
- [ ] For each user email:
  1. [ ] Query incidents from past week (7 days) for their subscribed firms
  2. [ ] If no incidents → Skip user (or send "quiet week" email - TBD)
  3. [ ] Generate HTML email with:
     - [ ] Personalized greeting (use user's name if available)
     - [ ] Section per firm with incidents
     - [ ] Each incident: severity badge, type, title, summary, source links
     - [ ] Unsubscribe link: `/api/unsubscribe?token=XXX` (JWT signed with user_id)
     - [ ] Footer with company branding
  4. [ ] Send via `sendEmail()` from `lib/resend.ts`
  5. [ ] Log result: `{ email, firms: [...], incidentsCount, status: 'sent'/'failed' }`
- [ ] Return summary:
  ```json
  { "sent": 85, "failed": 5, "errors": ["user@example.com: Resend API error"] }
  ```
- [ ] If Resend API fails → Log error, don't retry (will retry on next Monday)

**Email HTML Template:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Prop Firm Intelligence Digest</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Weekly Intelligence Digest</h1>
  <p>Hi {{userName}},</p>
  <p>Here's your weekly intelligence report for the week of {{weekStart}}:</p>

  {{#each firms}}
    <div style="margin: 30px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="margin-top: 0;">{{firmName}}</h2>

      {{#each incidents}}
        <div style="margin: 15px 0; padding: 15px; background: {{severityColor}}; border-radius: 4px;">
          <span style="font-weight: bold; color: {{severityTextColor}};">{{severity}} SEVERITY</span>
          <h3 style="margin: 10px 0;">{{title}}</h3>
          <p>{{summary}}</p>
          <p style="font-size: 12px; color: #666;">
            Sources: {{#each sourceLinks}}<a href="{{this}}">Link {{@index}}</a>{{/each}}
          </p>
        </div>
      {{/each}}
    </div>
  {{/each}}

  <p style="margin-top: 40px; font-size: 12px; color: #999;">
    <a href="{{unsubscribeUrl}}">Unsubscribe</a> from these reports
  </p>
</body>
</html>
```

**Testing:**

- [ ] Create test subscriber in `user_subscriptions` table
- [ ] Create test incidents in `weekly_incidents` for past week
- [ ] Call API locally: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/send-weekly-reports -X POST`
- [ ] Verify email received in test inbox
- [ ] Test error cases:
  - Invalid CRON_SECRET → 403
  - No subscribers → 200 with `{ sent: 0 }`
  - Resend API failure → Log error, return 500
- [ ] Manually trigger GitHub Actions workflow `send-weekly-reports.yml`

**Dependencies:**

- `user_subscriptions` table (see TICKET-008)
- `weekly_incidents` table
- `lib/resend.ts` (exists ✅)
- `RESEND_API_KEY` and `CRON_SECRET` env vars

**Files Changed:**

- `app/api/cron/send-weekly-reports/route.js` (new)

---

## Epic 2: Database Schema & Migrations

### TICKET-005: Create user_subscriptions Table 🔴 CRITICAL

**Status:** Not Started
**Priority:** P0 (Blocker)
**Story Points:** 2
**Assignee:** Backend Engineer

**Description:**

Create the `user_subscriptions` table to store user preferences for which firms they want to receive weekly intelligence reports for.

**Acceptance Criteria:**

- [ ] Create migration file `migrations/XX_user_subscriptions.sql` (replace XX with next number)
- [ ] Table schema:
  ```sql
  CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    firm_id TEXT NOT NULL,
    email TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_firm UNIQUE (user_id, firm_id)
  );

  CREATE INDEX idx_user_subscriptions_email ON user_subscriptions(email);
  CREATE INDEX idx_user_subscriptions_active ON user_subscriptions(active);
  ```
- [ ] Add RLS policies (if using Supabase RLS):
  ```sql
  ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can view their own subscriptions"
    ON user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can update their own subscriptions"
    ON user_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);
  ```
- [ ] Run migration in Supabase SQL Editor
- [ ] Verify table created with `\d user_subscriptions` in psql
- [ ] Update `migrations/README.md` with migration details

**Testing:**

- [ ] Insert test row: `INSERT INTO user_subscriptions (user_id, firm_id, email) VALUES (...)`
- [ ] Test unique constraint: Insert duplicate → Should fail
- [ ] Test cascade delete: Delete user from auth.users → Subscription deleted

**Files Changed:**

- `migrations/XX_user_subscriptions.sql` (new)
- `migrations/README.md` (update)

---

### TICKET-006: Verify weekly_incidents Table Schema

**Status:** Not Started
**Priority:** P0 (Blocker)
**Story Points:** 1
**Assignee:** Backend Engineer

**Description:**

Verify that the `weekly_incidents` table exists in the database and has the correct schema as required by the incident detection script.

**Acceptance Criteria:**

- [ ] Check if `weekly_incidents` table exists in Supabase
- [ ] Verify columns:
  - `id` SERIAL PRIMARY KEY
  - `firm_id` TEXT NOT NULL
  - `week_number` INTEGER NOT NULL
  - `year` INTEGER NOT NULL
  - `incident_type` TEXT NOT NULL
  - `severity` TEXT NOT NULL (values: 'high', 'medium', 'low')
  - `title` TEXT NOT NULL
  - `summary` TEXT
  - `review_count` INTEGER DEFAULT 0
  - `affected_users` INTEGER DEFAULT 0
  - `review_ids` INTEGER[] (array of review IDs)
  - `created_at` TIMESTAMPTZ DEFAULT NOW()
- [ ] Verify unique constraint:
  ```sql
  CONSTRAINT unique_weekly_incident UNIQUE (firm_id, year, week_number, incident_type)
  ```
- [ ] Verify indexes:
  ```sql
  CREATE INDEX idx_weekly_incidents_firm_week ON weekly_incidents(firm_id, year, week_number);
  ```
- [ ] If table doesn't exist or schema is incorrect → Create migration file

**Testing:**

- [ ] Query table: `SELECT * FROM weekly_incidents LIMIT 1;`
- [ ] Test upsert:
  ```sql
  INSERT INTO weekly_incidents (firm_id, year, week_number, incident_type, severity, title, summary, review_count, review_ids)
  VALUES ('fundingpips', 2025, 7, 'payout_delay', 'high', 'Test', 'Test summary', 5, ARRAY[1,2,3])
  ON CONFLICT (firm_id, year, week_number, incident_type)
  DO UPDATE SET review_count = EXCLUDED.review_count;
  ```

**Files Changed:**

- `migrations/XX_weekly_incidents.sql` (if table doesn't exist or needs changes)

---

### TICKET-007: Verify trustpilot_reviews Schema

**Status:** Not Started
**Priority:** P0 (Blocker)
**Story Points:** 1
**Assignee:** Backend Engineer

**Description:**

Verify that `trustpilot_reviews` table has the required `category` and `classified_at` fields for the classification script.

**Acceptance Criteria:**

- [ ] Check if `trustpilot_reviews` table exists
- [ ] Verify columns include:
  - `id` SERIAL PRIMARY KEY
  - `firm_id` TEXT NOT NULL
  - `rating` INTEGER NOT NULL
  - `title` TEXT
  - `review_text` TEXT NOT NULL
  - `reviewer_name` TEXT
  - `review_date` DATE NOT NULL
  - `trustpilot_url` TEXT UNIQUE NOT NULL
  - `category` TEXT (nullable) ← **Required for classification**
  - `classified_at` TIMESTAMPTZ (nullable) ← **Required for classification**
  - `created_at` TIMESTAMPTZ DEFAULT NOW()
- [ ] If `category` or `classified_at` fields missing → Add them via migration:
  ```sql
  ALTER TABLE trustpilot_reviews
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;

  CREATE INDEX idx_trustpilot_reviews_classified ON trustpilot_reviews(classified_at) WHERE classified_at IS NULL;
  ```

**Testing:**

- [ ] Query unclassified reviews: `SELECT COUNT(*) FROM trustpilot_reviews WHERE classified_at IS NULL;`
- [ ] Update test review: `UPDATE trustpilot_reviews SET category = 'payout_delay', classified_at = NOW() WHERE id = 1;`

**Files Changed:**

- `migrations/XX_trustpilot_reviews_classification.sql` (if fields missing)

---

### TICKET-008: Add last_scraper_run_at to firms Table

**Status:** Not Started
**Priority:** P1 (High)
**Story Points:** 1
**Assignee:** Backend Engineer

**Description:**

Add `last_scraper_run_at` field to the `firms` table to track when the Trustpilot scraper last ran for monitoring purposes.

**Acceptance Criteria:**

- [ ] Add column via migration:
  ```sql
  ALTER TABLE firms
  ADD COLUMN IF NOT EXISTS last_scraper_run_at TIMESTAMPTZ;
  ```
- [ ] Update scraper script to set this field after successful scrape:
  ```typescript
  await supabase
    .from('firms')
    .update({ last_scraper_run_at: new Date().toISOString() })
    .eq('id', firmId);
  ```

**Files Changed:**

- `migrations/XX_firms_scraper_timestamp.sql` (new)
- `scripts/backfill-trustpilot.ts` (update)

---

## Epic 3: UI Fixes & Enhancements

### TICKET-009: Fix Intelligence Page Data Range (90d → 30d) ⚠️ BUG

**Status:** Not Started
**Priority:** P1 (High)
**Story Points:** 1
**Assignee:** Frontend Engineer

**Description:**

The intelligence feed page currently shows 90 days of data, but the requirement is to show only the last 30 days. Update the API query and UI text to match.

**Acceptance Criteria:**

- [ ] File: `app/propfirms/[id]/intelligence/page.js`
- [ ] Line 138: Change `fetch(/api/v2/propfirms/${firmId}/incidents?days=90)` to `?days=30`
- [ ] Line 168: Change description from "last 90 days" to "last 30 days"
- [ ] Verify UI updates:
  - [ ] Page only shows incidents from past 30 days
  - [ ] Description text reads "Curated, summarized, and classified signals from the last 30 days."

**Testing:**

- [ ] Navigate to `/propfirms/fundingpips/intelligence`
- [ ] Verify only incidents from past 30 days shown
- [ ] Create incident with `week_start` = 40 days ago → Should NOT appear
- [ ] Create incident with `week_start` = 20 days ago → Should appear

**Files Changed:**

- `app/propfirms/[id]/intelligence/page.js` (lines 138, 168)

---

### TICKET-010: Add E2E Tests for Intelligence Feed Pages

**Status:** Not Started
**Priority:** P1 (High)
**Story Points:** 5
**Assignee:** QA Engineer / Frontend Engineer

**Description:**

Create Playwright E2E tests to verify the intelligence feed UI renders correctly and handles user interactions.

**Acceptance Criteria:**

- [ ] Create file `e2e/intelligence-feed.spec.js`
- [ ] Test cases:
  1. **Overview Page Intelligence Section:**
     - [ ] Navigate to `/propfirms/fundingpips`
     - [ ] Verify "Intelligence Feed" section visible
     - [ ] Verify "Live Reports" link present
     - [ ] Verify up to 3 incidents shown
     - [ ] Verify each incident has severity badge, title, summary
     - [ ] Click "Live Reports" → Navigates to intelligence page

  2. **Intelligence Page - Data Loading:**
     - [ ] Navigate to `/propfirms/fundingpips/intelligence`
     - [ ] Verify page title "Firm Intelligence Feed"
     - [ ] Verify loading skeletons appear initially
     - [ ] Wait for data → Verify skeleton replaced with incident cards

  3. **Intelligence Page - Filtering:**
     - [ ] Select filter "Operational" → Verify only operational incidents shown
     - [ ] Select filter "Reputation" → Verify only reputation incidents shown
     - [ ] Select "All Types" → Verify all incidents shown again

  4. **Intelligence Page - No Data State:**
     - [ ] Mock API to return empty incidents array
     - [ ] Verify "No intelligence signals in the last 30 days" message shown

  5. **Intelligence Page - Error State:**
     - [ ] Mock API to return 500 error
     - [ ] Verify error handling (currently no error UI, may need to add)

**Implementation:**

```javascript
// e2e/intelligence-feed.spec.js
import { test, expect } from '@playwright/test';

test.describe('Intelligence Feed', () => {
  test('shows intelligence section on overview page', async ({ page }) => {
    await page.goto('/propfirms/fundingpips');

    const section = page.locator('text=Intelligence Feed');
    await expect(section).toBeVisible();

    const liveReportsLink = page.locator('text=Live Reports');
    await expect(liveReportsLink).toBeVisible();

    // Verify incidents shown
    const incidents = page.locator('[class*="incident"]'); // Adjust selector
    await expect(incidents).toHaveCount({ min: 1, max: 3 });
  });

  test('intelligence page filters incidents by category', async ({ page }) => {
    await page.goto('/propfirms/fundingpips/intelligence');

    // Wait for data load
    await page.waitForSelector('[class*="IntelligenceCard"]');

    // Get initial count
    const allCount = await page.locator('[class*="IntelligenceCard"]').count();

    // Filter to Operational
    await page.selectOption('select', 'OPERATIONAL');
    await page.waitForTimeout(500); // Wait for filter

    const operationalCount = await page.locator('[class*="IntelligenceCard"]').count();
    expect(operationalCount).toBeLessThanOrEqual(allCount);
  });

  // Add more test cases...
});
```

**Testing:**

- [ ] Run tests: `npm run test:e2e`
- [ ] Verify all tests pass
- [ ] Add to CI/CD pipeline

**Files Changed:**

- `e2e/intelligence-feed.spec.js` (new)

---

## Epic 4: Testing & Quality

### TICKET-011: Add Unit Tests for Trustpilot Scraper

**Status:** Not Started
**Priority:** P1 (High)
**Story Points:** 5
**Assignee:** Backend Engineer

**Description:**

The `lib/scrapers/trustpilot.ts` file has no test coverage. Create comprehensive unit tests to reach ≥80% coverage as enforced by pre-commit hook.

**Acceptance Criteria:**

- [ ] Create file `lib/__tests__/scrapers/trustpilot.test.ts`
- [ ] Test cases:
  1. **scrapeTrustpilot():**
     - [ ] Valid firm ID → Returns reviews
     - [ ] Invalid firm ID → Returns error
     - [ ] Mock Playwright browser launch and page navigation
     - [ ] Test pagination: 3 pages scraped
     - [ ] Test duplicate detection within single scrape
     - [ ] Test maxReviews limit respected

  2. **storeReviews():**
     - [ ] Insert new reviews → Returns `{ stored: N, duplicates: 0 }`
     - [ ] Insert duplicates → Returns `{ stored: 0, duplicates: N }`
     - [ ] Mock Supabase client

  3. **scrapeAndStoreReviews():**
     - [ ] End-to-end flow (scrape + store)
     - [ ] Verify result contains `reviewsScraped`, `reviewsStored`, `duplicatesSkipped`

  4. **Helper Functions:**
     - [ ] `parseTrustpilotDate()` → Test relative dates ("2 days ago")
     - [ ] `parseTrustpilotDate()` → Test absolute dates ("January 24, 2026")
     - [ ] `randomDelay()` → Test delay range (±30% of base)

**Mocking:**

```typescript
import { jest } from '@jest/globals';

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(() => ({
      newContext: jest.fn(() => ({
        newPage: jest.fn(() => ({
          goto: jest.fn(),
          $$eval: jest.fn(() => [/* mock reviews */]),
          close: jest.fn(),
        })),
      })),
      close: jest.fn(),
    })),
  },
}));
```

**Testing:**

- [ ] Run tests: `npm run test lib/__tests__/scrapers/trustpilot.test.ts`
- [ ] Verify coverage: `npm run test:coverage`
- [ ] Coverage should be ≥80% for `lib/scrapers/trustpilot.ts`

**Files Changed:**

- `lib/__tests__/scrapers/trustpilot.test.ts` (new)

---

### TICKET-012: Add API Route Tests for send-weekly-reports

**Status:** Not Started
**Priority:** P1 (High)
**Story Points:** 3
**Assignee:** Backend Engineer

**Description:**

Create tests for the new weekly reports cron API route to ensure authentication, email sending, and error handling work correctly.

**Acceptance Criteria:**

- [ ] Create file `app/api/cron/send-weekly-reports/route.test.js`
- [ ] Test cases:
  1. **Authentication:**
     - [ ] Missing Authorization header → 403
     - [ ] Invalid CRON_SECRET → 403
     - [ ] Valid CRON_SECRET → Proceeds to logic

  2. **Email Sending:**
     - [ ] Active subscribers found → Sends emails
     - [ ] No subscribers → Returns `{ sent: 0, failed: 0 }`
     - [ ] Mock Supabase queries
     - [ ] Mock Resend `sendEmail()` calls

  3. **Error Handling:**
     - [ ] Supabase query failure → 500
     - [ ] Resend API failure → Logs error, returns partial success
     - [ ] Invalid email address → Skips, logs error

**Implementation:**

```javascript
import { POST } from './route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/resend', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: [/* mock subscriptions */],
          error: null,
        })),
      })),
    })),
  })),
}));

describe('POST /api/cron/send-weekly-reports', () => {
  it('returns 403 if CRON_SECRET is invalid', async () => {
    const req = new NextRequest('http://localhost/api/cron/send-weekly-reports', {
      method: 'POST',
      headers: { Authorization: 'Bearer WRONG_SECRET' },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // Add more tests...
});
```

**Testing:**

- [ ] Run tests: `npm run test app/api/cron/send-weekly-reports/route.test.js`
- [ ] Verify all test cases pass

**Files Changed:**

- `app/api/cron/send-weekly-reports/route.test.js` (new)

---

## Epic 5: Monitoring & Observability

### TICKET-013: Add Intelligence Feed Metrics to Admin Dashboard

**Status:** Not Started
**Priority:** P1 (High)
**Story Points:** 8
**Assignee:** Full-stack Engineer

**Description:**

Extend the admin dashboard to display intelligence feed pipeline metrics for monitoring scraper, classifier, incident detector, and email reports.

**Acceptance Criteria:**

- [ ] Extend `GET /api/admin/metrics` endpoint:
  - [ ] Add `intelligenceFeed` object to response:
    ```json
    {
      "intelligenceFeed": {
        "scraper": {
          "lastRun": "2025-02-14T11:05:00Z",
          "reviewsCount": 2450,
          "errors": []
        },
        "classifier": {
          "unclassified": 15,
          "lastRun": "2025-02-14T12:05:00Z",
          "errorRate": 0.02
        },
        "incidents": {
          "currentWeek": 12,
          "byFirm": { "fundingpips": 3, "the5ers": 2, ... },
          "bySeverity": { "high": 2, "medium": 5, "low": 5 }
        },
        "emailReports": {
          "lastSent": "2025-02-10T14:05:00Z",
          "subscribers": 145,
          "successRate": 0.98,
          "errors": []
        }
      }
    }
    ```
- [ ] Add UI section in `app/admin/dashboard/page.js` after line 433:
  - [ ] Section title: "Intelligence Feed Pipeline"
  - [ ] 4 cards:
    1. **Scraper Status:** Last run timestamp, total reviews, error count
    2. **Classifier Status:** Unclassified count, last run, error rate
    3. **Incidents:** Current week count, breakdown by firm and severity
    4. **Email Reports:** Last sent, subscriber count, success rate
- [ ] Style cards consistently with existing dashboard design (DaisyUI v5)

**Implementation (UI):**

```javascript
{/* Intelligence Feed Pipeline */}
<section>
  <h2 className="text-lg font-semibold mb-4">Intelligence Feed Pipeline</h2>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {/* Scraper */}
    <div className="card card-border bg-base-100 shadow">
      <div className="card-body">
        <h3 className="text-sm font-medium text-base-content/70">Scraper</h3>
        <div className="text-2xl font-bold">{data.intelligenceFeed?.scraper?.reviewsCount ?? '—'}</div>
        <p className="text-xs text-base-content/60">
          Last run: {data.intelligenceFeed?.scraper?.lastRun
            ? new Date(data.intelligenceFeed.scraper.lastRun).toLocaleString()
            : '—'}
        </p>
      </div>
    </div>

    {/* Classifier */}
    <div className="card card-border bg-base-100 shadow">
      <div className="card-body">
        <h3 className="text-sm font-medium text-base-content/70">Classifier</h3>
        <div className="text-2xl font-bold">{data.intelligenceFeed?.classifier?.unclassified ?? '—'}</div>
        <p className="text-xs text-base-content/60">Unclassified reviews</p>
      </div>
    </div>

    {/* Add Incidents and Email cards... */}
  </div>
</section>
```

**Testing:**

- [ ] Navigate to `/admin/dashboard`
- [ ] Verify new section renders
- [ ] Check metrics update on refresh
- [ ] Test CSV export includes new metrics

**Files Changed:**

- `app/api/admin/metrics/route.js` (extend response)
- `app/admin/dashboard/page.js` (add UI section)

---

### TICKET-014: Configure Error Alerts for Intelligence Pipeline

**Status:** Not Started
**Priority:** P2 (Medium)
**Story Points:** 5
**Assignee:** DevOps / Backend Engineer

**Description:**

Add email alerts for intelligence feed pipeline failures to the existing admin alert system.

**Acceptance Criteria:**

- [ ] Extend `lib/alerts.js` (or create if missing) to add checks:
  1. **Scraper failure:** If `last_scraper_run_at` is >25 hours ago → Send alert
  2. **Classifier backlog:** If unclassified reviews >500 → Send alert
  3. **Incident detection failure:** If last run >25 hours ago → Send alert
  4. **Email delivery rate:** If success rate <80% on last Monday → Send alert
- [ ] Check conditions in `GET /api/admin/metrics`
- [ ] Send email via `lib/resend.ts` to `ALERT_EMAIL`
- [ ] Throttle: Max 1 email per condition per 4 hours
- [ ] Email subject: "🚨 Intelligence Feed Alert: [Condition]"

**Implementation:**

```javascript
// lib/alerts.js
export async function checkIntelligenceFeedAlerts(metrics) {
  const alerts = [];

  // Scraper failure
  const lastScraperRun = new Date(metrics.intelligenceFeed.scraper.lastRun);
  const hoursSinceLastRun = (Date.now() - lastScraperRun.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLastRun > 25) {
    alerts.push({
      type: 'scraper_failure',
      message: `Scraper hasn't run in ${hoursSinceLastRun.toFixed(1)} hours`,
    });
  }

  // Classifier backlog
  if (metrics.intelligenceFeed.classifier.unclassified > 500) {
    alerts.push({
      type: 'classifier_backlog',
      message: `${metrics.intelligenceFeed.classifier.unclassified} unclassified reviews`,
    });
  }

  // Send alerts if any
  for (const alert of alerts) {
    await sendAlert(alert);
  }
}
```

**Testing:**

- [ ] Simulate scraper failure (set `last_scraper_run_at` to 26 hours ago)
- [ ] Call `/api/admin/metrics` → Verify alert email sent
- [ ] Check throttling: Call again within 4 hours → No duplicate email

**Files Changed:**

- `lib/alerts.js` (new or extend)
- `app/api/admin/metrics/route.js` (call alert checks)

---

## Epic 6: Documentation & Deployment

### TICKET-015: Update Documentation

**Status:** Not Started
**Priority:** P2 (Medium)
**Story Points:** 2
**Assignee:** Tech Lead

**Description:**

Update project documentation to reflect the new intelligence feed system.

**Acceptance Criteria:**

- [ ] Update `README.md`:
  - [ ] Add "Intelligence Feed" section explaining the feature
  - [ ] Document GitHub Actions workflows
  - [ ] Add environment variables required
- [ ] Update `migrations/README.md`:
  - [ ] Document new tables: `user_subscriptions`, `weekly_incidents`, `trustpilot_reviews` schema changes
- [ ] Create `documents/runbooks/intelligence-feed-operations.md`:
  - [ ] How to manually trigger workflows
  - [ ] How to debug scraper failures
  - [ ] How to check email delivery logs
  - [ ] How to add new firms to scraper

**Files Changed:**

- `README.md` (update)
- `migrations/README.md` (update)
- `documents/runbooks/intelligence-feed-operations.md` (new)

---

### TICKET-016: Configure Production Environment Variables

**Status:** Not Started
**Priority:** P0 (Blocker - before deploy)
**Story Points:** 1
**Assignee:** DevOps

**Description:**

Set up all required environment variables in Vercel and GitHub Secrets for production deployment.

**Acceptance Criteria:**

**Vercel Environment Variables:**

- [ ] `OPENAI_API_KEY` (for classification and summaries)
- [ ] `RESEND_API_KEY` (for weekly emails)
- [ ] `CRON_SECRET` (for webhook authentication)
- [ ] `ALERT_EMAIL` or `ALERTS_TO` (for monitoring alerts)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` ✅ (already set)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ (already set)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ✅ (already set)

**GitHub Secrets:**

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `CRON_SECRET` (must match Vercel)
- [ ] `SITE_URL` (e.g., `https://your-app.vercel.app`)

**Verification:**

- [ ] Test each workflow manually in GitHub Actions
- [ ] Verify secrets are accessible in workflow runs
- [ ] Test API route authentication with CRON_SECRET

**Files Changed:**

- None (configuration only)

---

### TICKET-017: Deploy to Production

**Status:** Not Started
**Priority:** P0 (Final step)
**Story Points:** 3
**Assignee:** Tech Lead + DevOps

**Description:**

Deploy the intelligence feed system to production and monitor initial runs.

**Acceptance Criteria:**

**Pre-deployment:**

- [ ] All P0 tickets completed
- [ ] All tests passing (`npm run test:coverage:enforce-new`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual QA on staging completed
- [ ] Environment variables configured
- [ ] Database migrations applied in production

**Deployment:**

- [ ] Merge feature branch to `main`
- [ ] Deploy to Vercel staging
- [ ] Run smoke tests on staging
- [ ] Promote to production

**Post-deployment Monitoring (48 hours):**

- [ ] Day 1 (3 AM PST): Monitor scraper workflow
  - [ ] Check GitHub Actions logs
  - [ ] Verify reviews inserted into DB
  - [ ] Check `/admin/dashboard` metrics
- [ ] Day 1 (4 AM PST): Monitor classifier workflow
  - [ ] Verify reviews classified
  - [ ] Check OpenAI API usage
- [ ] Day 1 (5 AM PST): Monitor incident detection
  - [ ] Verify incidents created in DB
  - [ ] Check UI displays incidents
- [ ] Day 7 (Monday 2 PM UTC): Monitor weekly email send
  - [ ] Verify emails sent to subscribers
  - [ ] Check Resend delivery logs
  - [ ] Monitor for errors

**Rollback Criteria:**

- [ ] Scraper fails 2 consecutive runs → Disable workflow, investigate
- [ ] Email send fails → Check Resend logs, fix route
- [ ] UI breaks → Revert PR, redeploy previous version
- [ ] Database migration failure → Rollback via Supabase

**Files Changed:**

- None (deployment only)

---

## Sprint Summary

### High-Level Breakdown

| Epic | Tickets | Story Points | Priority |
|------|---------|--------------|----------|
| Async Data Pipeline | 4 | 37 | P0 |
| Database Schema | 4 | 5 | P0 |
| UI Fixes | 2 | 6 | P1 |
| Testing | 2 | 8 | P1 |
| Monitoring | 2 | 13 | P1-P2 |
| Documentation | 2 | 3 | P2 |
| **Total** | **17** | **72** | — |

### Critical Path (Must Complete for Alpha)

1. **Database Setup (5 pts):**
   - TICKET-005, 006, 007, 008

2. **Scripts (37 pts):**
   - TICKET-001: Trustpilot scraper script
   - TICKET-002: Classification script
   - TICKET-003: Incident detection script
   - TICKET-004: Weekly email API route

3. **UI Fix (1 pt):**
   - TICKET-009: 90d → 30d data range

4. **Environment (1 pt):**
   - TICKET-016: Configure env vars

5. **Deploy (3 pts):**
   - TICKET-017: Production deployment

**Total Critical Path:** 47 story points (~2-3 weeks with 2 engineers)

### Testing & Quality (Can Defer to Post-Alpha)

- TICKET-010: E2E tests
- TICKET-011: Scraper unit tests
- TICKET-012: API route tests

### Monitoring (Can Defer to Post-Alpha)

- TICKET-013: Admin dashboard metrics
- TICKET-014: Error alerts

### Documentation (Can Defer)

- TICKET-015: Update docs

---

## Test Coverage Checklist

### Pre-Commit Hook Requirement

All files in `lib/`, `app/api/`, `components/` must have ≥80% test coverage.

**Current Coverage Status:**

✅ **Components:**
- `components/propfirms/intelligence/IntelligenceCard.js` → HAS TEST
- `components/propfirms/intelligence/IntelligenceCardSkeleton.js` → HAS TEST

✅ **API Routes:**
- `app/api/v2/propfirms/[id]/incidents/route.js` → HAS TEST
- `app/api/v2/propfirms/[id]/signals/route.js` → HAS TEST

❌ **Missing Tests (Will fail pre-commit):**
- `lib/scrapers/trustpilot.ts` → TICKET-011
- `app/api/cron/send-weekly-reports/route.js` → TICKET-012
- `scripts/backfill-trustpilot.ts` (scripts folder not covered by hook ✅)
- `scripts/classify-unclassified-reviews.ts` (scripts folder not covered ✅)
- `scripts/run-daily-incidents.ts` (scripts folder not covered ✅)

**Action Items:**

- [ ] Complete TICKET-011 (scraper tests) before merging to main
- [ ] Complete TICKET-012 (email route tests) before merging to main
- [ ] Scripts in `scripts/` folder are not enforced by hook, but should have tests for quality

---

## Risk Assessment

### High Risk

1. **OpenAI API Costs:** Classification + incident summaries may exceed budget
   - **Mitigation:** Monitor daily spend, set usage limits, cache results

2. **Email Deliverability:** Resend API may block or rate-limit
   - **Mitigation:** Start with small subscriber list, monitor bounce rate

3. **Scraper Blocking:** Trustpilot may detect and block Playwright
   - **Mitigation:** Use stealth mode (already configured), randomize delays, monitor error rate

### Medium Risk

4. **Database Performance:** Large incident queries may slow UI
   - **Mitigation:** Add indexes (already in schema), monitor query times

5. **Workflow Failures:** GitHub Actions may fail silently
   - **Mitigation:** Set up error alerts (TICKET-014), monitor daily

### Low Risk

6. **Schema Changes:** Database migrations may fail in production
   - **Mitigation:** Test on staging first, have rollback plan

---

## Success Metrics

### Alpha Release KPIs

1. **Data Pipeline:**
   - [ ] Scraper success rate >95% (last 30 days)
   - [ ] Classification accuracy >90% (manual review of 100 samples)
   - [ ] Incident detection runs daily without failure

2. **User Engagement:**
   - [ ] Weekly emails sent to ≥100 subscribers
   - [ ] Email open rate >20%
   - [ ] Email click-through rate >5%

3. **Performance:**
   - [ ] Intelligence page load time <2s (P95)
   - [ ] API response time <500ms (P95)

4. **Reliability:**
   - [ ] Zero data loss in pipeline
   - [ ] Zero production incidents caused by deployment

---

**Sprint Start Date:** TBD
**Sprint End Date:** TBD (2-3 weeks estimated)
**Scrum Master:** TBD
**Product Owner:** TBD
