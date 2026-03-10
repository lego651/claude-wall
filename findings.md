# Findings: Gmail Ingest → Firm Content Timeline

## DB Schema (Already Exists)

### `firm_content_items` (migration 26)
- `firm_id TEXT` → references `firm_profiles(id)`
- `content_type TEXT` → CHECK IN ('company_news', 'rule_change', 'promotion', 'other')
- `title TEXT`, `raw_content TEXT`, `source_url TEXT`
- `source_type TEXT` → CHECK IN ('manual_upload', **'firm_email'**, 'discord', 'twitter', 'reddit', 'blog', 'other')
- `ai_summary TEXT`, `ai_category TEXT`, `ai_confidence FLOAT`, `ai_tags TEXT[]`
- `published BOOLEAN DEFAULT FALSE`
- `content_date DATE NOT NULL`

→ **`source_type: 'firm_email'` already planned in the schema.** ✅

### `industry_news_items` (migration 27)
- Same structure but no `firm_id`, has `mentioned_firm_ids TEXT[]`
- `source_type` does NOT include `firm_email` — general emails would need 'other'

### `cron_last_run` (migration 21)
- Tracks last run of cron jobs — can use this for Gmail sync tracking (`job_name: 'ingest-firm-emails'`)

---

## AI Layer (Already Exists)

### `lib/ai/categorize-content.ts`
- Function: `categorizeContent(rawContent, metadata)`
- Returns: `{ ai_category, ai_summary, ai_confidence, ai_tags, mentioned_firm_ids }`
- Categories: `company_news`, `rule_change`, `promotion`, `industry_news`, `other`
- Model: `gpt-4o-mini`, temp 0.3
- **Ready to use as-is** ✅

---

## Frontend (Intelligence Page)

### Current state: `/propfirms/[id]/intelligence/page.js`
- Fetches from `/api/v2/propfirms/${firmId}/incidents?days=30&limit=20`
- Shows `IntelligenceCard` components (Trustpilot-based incidents)
- Has a filter dropdown (Risk / Watch / Positive / All)
- Has vertical timeline layout

### What to add:
- New section below intelligence feed: "Company Feed" with tabs
- Need new API endpoint: `/api/v2/propfirms/[id]/content`
- Two tabs: Timeline (news + rules) and Promotions

---

## Admin UI (Already Exists, Broken Backend)

### `/admin/content/upload/page.js`
- Already has full form UI for firm content + industry news
- Calls `/api/admin/content/firm` (POST) and `/api/admin/content/industry` (POST)
- **These API routes DO NOT EXIST yet** — only classify-reviews, arbiscan-usage, metrics, test-alert exist under `/api/admin/`
- Once we create the API routes, the form will work

---

## Cron System

- Pattern: `app/api/cron/{job-name}/route.js`
- Auth: `CRON_SECRET` header
- Existing jobs: `send-weekly-reports`, `sync-payouts`
- Schedule: defined in `vercel.json` (check) or external

---

## Firm List (Current)

Known firms in admin upload form:
- fundingpips, fxify, fundednext, the5ers, instantfunding, blueguardian, aquafunded, alphacapitalgroup, ftmo, topstep, apex

Need to create sender → firm mapping. Most firms have predictable domains (e.g. `@fundingpips.com`, `@fxify.com`).

---

## Gmail API Approach

**Option A: OAuth2 with refresh token (Recommended)**
- One-time OAuth flow to get refresh_token
- Store in `.env`: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL`
- Use `googleapis` npm package
- Poll with `users.messages.list` + `users.messages.get`
- Track sync using `historyId` (Gmail's incremental sync) or `cron_last_run` timestamp

**Option B: IMAP (Not recommended)**
- More complex, Gmail requires "less secure app access" or App Password
- Less efficient for polling

**Gmail API incremental sync pattern:**
1. First run: `messages.list(q: 'in:inbox is:unread')` → process all, save `historyId`
2. Subsequent runs: `history.list(startHistoryId: savedId)` → only new messages
3. Or simpler: `messages.list(q: 'in:inbox after:{unix_timestamp}')` using `cron_last_run`

**Dedup:** Store `gmail_message_id` in `firm_content_items` to prevent re-processing.
- Need to add `external_id TEXT UNIQUE` column to `firm_content_items` (migration 33)

---

## Missing Pieces (Gap Analysis)

| Gap | Solution |
|-----|----------|
| No Gmail client | Create `lib/gmail/client.ts` using `googleapis` |
| No email parser | Create `lib/gmail/parser.ts` — strip HTML, extract text |
| No sender→firm mapping | Create `lib/gmail/firm-mapper.ts` + migration 33 for sender config table |
| No ingest cron | Create `app/api/cron/ingest-firm-emails/route.js` |
| No admin content API | Create `app/api/admin/content/firm/route.js` + industry |
| No public content API | Create `app/api/v2/propfirms/[id]/content/route.js` |
| No frontend feed | Create `CompanyFeedTab` component + integrate into intelligence page |
| `firm_content_items` missing `external_id` | Migration 33 to add `external_id TEXT UNIQUE` |
