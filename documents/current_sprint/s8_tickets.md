# S8 Tickets: Twitter / X Monitoring Pipeline

**Scope:** [s8_scope.md](./s8_scope.md)  
**Design:** [s8_twitter-design-decisions.md](./s8_twitter-design-decisions.md) (batch categorization, dedicated table, importance_score, top-3-per-firm-per-week).  
**Order:** Config → Apify client → Fetch job → **Migration** (firm_twitter_tweets) → **Batch AI + ingest** → Cron → **Digest integration** → Runbook.

---

## S8-TW-001: Twitter monitoring config (firms + industry keywords)

**Goal:** Single place to define which firms we monitor for Twitter and which search terms to use (firm + industry).

**Options (pick one):**

- **A) Config file** – e.g. `config/twitter-monitoring.js` or section in `config.js`: list of `{ firmId, searchTerms[] }` for the 3 firms, and `industrySearchTerms[]`. Easy to edit without DB.
- **B) DB table** – e.g. `twitter_monitoring_firms` (firm_id, search_terms text[]), `twitter_monitoring_industry` (keyword). More flexible later; requires migration.

**Required content:**

- **Firms:** `fundednext`, `fundingpips`, `alphacapitalgroup` each with multiple search terms (see scope doc §3). Example: FundingPips → `["FundingPips", "Funding Pips", "from:FundingPips", "FundingPips prop firm", "FundingPips payout"]`.
- **Industry:** Array of keywords, e.g. `["prop firm", "prop firms news", "Topstep", "prop firm news", "funded trading", "prop trading news"]`.

**Acceptance:**

- [x] Config or table exists and is used by the fetch job (S8-TW-002) so we can add/change terms without code change.
- [x] At least 3–5 terms per firm and 5+ industry keywords as in scope.

---

## S8-TW-002: Apify client – run Twitter Actor and return normalized tweets

**Goal:** Reusable way to run the chosen Apify Actor (e.g. Kaito “Cheapest” Tweet Scraper) with a list of search terms and a max-items cap, and return a normalized list of tweets (id, text, url, author, date).

**Tasks:**

1. **Env** – Document `APIFY_TOKEN` in `.env.example` and runbook; job must read it at runtime.
2. **Client** – Add `lib/apify/` (or `lib/twitter-apify.ts`): function that accepts `searchTerms: string[]`, `maxItemsPerTerm?: number`, and optionally `maxItemsTotal`. Calls Apify REST API to start run, polls until done, fetches dataset, normalizes to a common shape (e.g. `{ id, text, url, authorUsername, createdAt }`). Actor ID should be configurable (env or config).
3. **Actor input** – Map our search terms to the Actor’s input schema (e.g. Kaito uses `searchTerms` array and `maxItems`; see Apify Actor docs). Handle one run per term or one run with multiple terms depending on Actor.
4. **Errors** – If Apify run fails or times out, log and return partial results or empty; don’t crash the full job.

**Acceptance:**

- [x] Unit or integration test: mock Apify response and assert normalized output shape.
- [x] Readme or runbook: how to get `APIFY_TOKEN`, which Actor ID is used, and how to run the client manually (e.g. small script that runs for one firm and logs tweets). (.env.example documents APIFY_TOKEN; Actor ID in lib/apify/twitter-scraper.ts DEFAULT_ACTOR_ID; runbook in S8-TW-006.)

---

## S8-TW-003: Fetch job – run Apify for monitored firms and industry

**Goal:** Script or entrypoint that (1) reads Twitter monitoring config (S8-TW-001), (2) for each monitored firm runs Apify with that firm’s search terms, (3) runs Apify once for industry keywords, (4) aggregates and dedupes by tweet ID, (5) outputs or passes a single list of “raw tweets” with a flag or source indicating “firm” (with firm_id) vs “industry”.

**Tasks:**

- For each of the 3 firms: call Apify client with firm’s `searchTerms`, cap `maxItems` (e.g. 30–50 per term or 100 per firm).
- One run for industry: call Apify with industry keywords, cap total items (e.g. 100).
- Merge all tweets and dedupe by tweet `id` (or URL); attach `firm_id` for firm-sourced tweets and `source: 'industry'` for industry-sourced.
- Output: array of `{ tweetId, text, url, author, date, firmId?: string, source: 'firm'|'industry' }` to be consumed by ingest (S8-TW-004).

**Acceptance:**

- [x] Running the script with valid `APIFY_TOKEN` and config produces a list of tweets; no duplicate tweet IDs in the list; firm tweets have `firmId`, industry tweets have `source: 'industry'`.
- [x] Configurable max items per firm/industry to avoid blowing Apify credits (env or config). (Env: `TWITTER_MAX_ITEMS_PER_FIRM`, `TWITTER_MAX_ITEMS_INDUSTRY`, `TWITTER_MAX_ITEMS_PER_TERM`.)

**Implemented:** `lib/twitter-fetch/fetch-job.ts` (`runTwitterFetchJob()`), `scripts/twitter-fetch-job.ts` (runnable script), tests in `lib/twitter-fetch/__tests__/fetch-job.test.ts`.

---

## S8-TW-003b: Migration – create `firm_twitter_tweets` table

**Goal:** Dedicated table for firm-level tweets with importance scoring. Digest will query “top 3 per firm per week” from this table (see design doc).

**Schema (proposed):**

- `id` SERIAL PRIMARY KEY
- `firm_id` TEXT NOT NULL REFERENCES firm_profiles(id)
- `tweet_id` TEXT NOT NULL (external X id)
- `url` TEXT NOT NULL (tweet permalink)
- `text` TEXT NOT NULL
- `author_username` TEXT
- `tweeted_at` DATE NOT NULL (date of the tweet)
- `category` TEXT (from AI: company_news, rule_change, promotion, complaint, off_topic, etc.)
- `ai_summary` TEXT
- `importance_score` FLOAT CHECK (importance_score >= 0 AND importance_score <= 1)
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- UNIQUE (firm_id, url) for dedupe

**Tasks:**

- Add migration in `migrations/` (e.g. `28_firm_twitter_tweets.sql`): create table, indexes (firm_id, tweeted_at; firm_id, importance_score DESC), RLS if needed (e.g. service role only for cron; optional read for admin).

**Acceptance:**

- [x] Table exists; ingest job can insert and digest can query by firm_id and week with ORDER BY importance_score DESC LIMIT 3.

**Implemented:** `migrations/29_firm_twitter_tweets.sql` (table, unique on (firm_id, url), indexes for firm/tweeted_at/importance, RLS for admins).

---

## S8-TW-004: Batch AI + ingest – tweets → firm_twitter_tweets / industry_news_items

**Goal:** (1) Skip tweets already in DB (dedupe by url). (2) **Batch** categorize tweets (e.g. 20 per OpenAI call, like Trustpilot) and get **category, summary, importance_score** per tweet. (3) Insert firm tweets into **`firm_twitter_tweets`**; industry tweets into **`industry_news_items`** with `source_type = 'twitter'`.

**Implemented:**

- **Batch AI:** `lib/ai/categorize-tweets.ts` – `categorizeTweetBatch(tweets, { isIndustry })` returns `{ category, summary, importance_score, mentioned_firm_ids? }[]`; categories company_news, rule_change, promotion, complaint, off_topic, other; batch size from `TWITTER_AI_BATCH_SIZE` (env, default 20, max 25).
- **Ingest:** `lib/twitter-ingest/ingest.ts` – `ingestTweets(fetched)` dedupes (one query per table), runs batch AI in chunks, inserts firm → `firm_twitter_tweets`, industry → `industry_news_items` (source_type = 'twitter', title = truncated text, published = false).
- **Script:** `scripts/twitter-fetch-job.ts` runs fetch then ingest (cron can use same script). Env: APIFY_TOKEN, OPENAI_API_KEY, Supabase keys; optional TWITTER_AI_BATCH_SIZE.

**Tasks:**

1. **Batch AI** – New function (e.g. in `lib/ai/`) that accepts an array of tweet objects `{ text, url?, author? }`, builds a single prompt for up to ~20 tweets, returns array of `{ category, summary, importance_score }` in same order. Prompt must define categories (company_news, rule_change, promotion, complaint, off_topic, other) and ask for importance_score 0–1 (“How important is this tweet for the firm’s subscribers?”). Batch size configurable (default 20, max e.g. 25).
2. **Dedupe** – Firm: skip if (firm_id, url) exists in `firm_twitter_tweets`. Industry: skip if source_url exists in `industry_news_items`.
3. **Firm tweets** – Insert into `firm_twitter_tweets`: firm_id, tweet_id, url, text, author_username, tweeted_at (from tweet date), category, ai_summary, importance_score. No `published` flag; digest selects by importance.
4. **Industry tweets** – Insert into `industry_news_items`: title (truncated text or AI), raw_content, source_url, source_type = 'twitter', ai_summary, ai_category, mentioned_firm_ids from AI, content_date, published = false (industry can keep review flow if desired, or set true by default for Twitter).
5. **Idempotency** – Re-run produces no duplicate rows (dedupe by url / (firm_id, url)).

**Acceptance:**

- [x] New tweets are categorized in **batches** (e.g. 20 per OpenAI call); each result includes importance_score.
- [x] Firm tweets are stored in `firm_twitter_tweets` with importance_score; no duplicates for same (firm_id, url).
- [x] Industry tweets are stored in `industry_news_items` with source_type = 'twitter'.
- [x] Batch size is configurable (env or constant); same pattern as Trustpilot’s CLASSIFY_AI_BATCH_SIZE.

---

## S8-TW-005: Cron – schedule daily (or 2× daily) Twitter fetch + ingest

**Goal:** Run the Twitter pipeline automatically (fetch → ingest) on a schedule without manual steps.

**Implemented:**

- **Cron entrypoint:** `scripts/twitter-fetch-job.ts` already does fetch (S8-TW-003) then ingest (S8-TW-004) in one run.
- **GitHub Actions:** `.github/workflows/daily-step-twitter-fetch-ingest.yml` – runs at 14:00 UTC daily (6 AM PST), after Trustpilot steps (11–13 UTC). `workflow_dispatch` for manual run.
- **Secrets:** `APIFY_TOKEN`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same as other daily workflows).
- **Logging:** Script logs start/end, fetch counts, insert/skip counts; errors (e.g. Apify/OpenAI) surface as step failure in Actions (no tokens logged).

**Tasks:**

- Add a **cron entrypoint** that: (1) runs the fetch job (S8-TW-003), (2) runs the ingest step (S8-TW-004) on the fetched tweets. Can be one script that does both, or two steps in one workflow.
- Schedule via **GitHub Actions** (e.g. `daily-step-twitter-fetch-ingest.yml`) or **Vercel Cron** (e.g. `app/api/cron/twitter-fetch/route.ts` that calls the same logic). Prefer same pattern as Trustpilot (GitHub Actions) for consistency.
- **Secrets:** `APIFY_TOKEN` in GitHub secrets or Vercel env; Supabase available for ingest (service role or existing cron env).
- **Logging** – Log run start/end, number of tweets fetched, number inserted/skipped, and any Apify/OpenAI errors (without exposing tokens).

**Acceptance:**

- [x] Cron runs at least once per day (e.g. 6 AM UTC or after Trustpilot classify).
- [x] On success, new firm tweets appear in `firm_twitter_tweets`, industry in `industry_news_items`; no duplicate rows.
- [x] On failure (Apify down, token invalid), job fails visibly (log/alert) and does not corrupt DB.

---

## S8-TW-006: Runbook – Twitter monitoring operations

**Goal:** Short runbook so anyone can operate and tune the Twitter pipeline.

**Implemented:** `documents/runbooks/twitter-monitoring.md` with Overview, Prerequisites (APIFY_TOKEN, Actor ID), Config (`config/twitter-monitoring.ts`), Running manually (`npx tsx scripts/twitter-fetch-job.ts`), Cron (workflow + how to change schedule), Troubleshooting, Cost. Linked from README (Intelligence Feed + Documentation) and from [daily-scraper-weekly-incidents-reports-operations.md](../runbooks/daily-scraper-weekly-incidents-reports-operations.md).

**Contents:**

1. **Overview** – What the pipeline does (fetch from Apify → ingest as draft → admin approves).
2. **Prerequisites** – `APIFY_TOKEN` (where to get it, where to set it); which Apify Actor is used and how much it costs.
3. **Config** – Where firm and industry search terms are defined (file or table); how to add a new firm or keyword.
4. **Running manually** – How to run the fetch + ingest script locally or via a one-off API call (if implemented).
5. **Cron** – Where the schedule is defined (workflow file or Vercel cron), and how to change frequency.
6. **Troubleshooting** – Common errors (invalid token, Apify timeout, OpenAI rate limit); where to see logs; how to temporarily disable (e.g. comment out workflow or flip a flag).
7. **Cost** – Reminder: Apify $5 free credits/month; batch OpenAI (20 tweets/call); link to spike doc.

**Acceptance:**

- [x] Runbook lives in `documents/runbooks/` (e.g. `twitter-monitoring.md`) and is linked from main README or intelligence-feed runbook.
- [x] New dev can follow it to set up token, run one manual fetch, and understand where to edit keywords.

---

## S8-TW-006b: Digest – include “Top tweets” per firm (up to 3 per week)

**Goal:** Weekly digest shows **up to 3 most important tweets per firm** for the report week, selected by importance_score (no admin approval step for firm tweets).

**Tasks:**

1. **Data** – In content aggregator (or digest generator), for each firm: query `firm_twitter_tweets` where `firm_id = X` and `tweeted_at` in the report week, ORDER BY importance_score DESC, LIMIT 3.
2. **Digest payload** – Add a field per firm, e.g. `topTweets: { firmId: string; tweets: { url, text, authorUsername, tweeted_at, ai_summary, importance_score }[] }` (or reuse existing structure if one fits).
3. **Email template** – Add a “Top tweets” or “Notable mentions” block per firm in the weekly digest HTML (e.g. 1–3 items with link, summary, date). If a firm has 0 tweets in the week, omit the block.

**Acceptance:**

- [ ] Weekly report generation includes top 3 tweets per firm from `firm_twitter_tweets` for the week.
- [ ] Digest email displays them per firm (up to 3); subscribers see the block when data exists.

---

## S8-TW-007 (optional): Admin UX for tweets

**Goal:** Optional admin view to see recent firm tweets (e.g. from `firm_twitter_tweets`) or filter industry news by source = Twitter. Not required for “top 3 in digest” flow.

**Tasks:** e.g. list recent rows from `firm_twitter_tweets` per firm; or in industry news review, show/filter by source_type = 'twitter'.

**Acceptance:** Admin can inspect or filter Twitter-sourced data if implemented.

---

## Ticket order summary

| Order | Ticket | What |
|-------|--------|------|
| 1 | S8-TW-001 | Config: firms + industry keywords ✅ |
| 2 | S8-TW-002 | Apify client: run Actor, normalize tweets ✅ |
| 3 | S8-TW-003 | Fetch job: run Apify for 3 firms + industry, dedupe |
| 3b | S8-TW-003b | Migration: create firm_twitter_tweets table |
| 4 | S8-TW-004 | Batch AI + ingest: firm_twitter_tweets / industry_news_items (with importance_score) |
| 5 | S8-TW-005 | Cron: schedule fetch + ingest daily |
| 6 | S8-TW-006 | Runbook for Twitter monitoring |
| 6b | S8-TW-006b | Digest: top 3 tweets per firm per week (from firm_twitter_tweets) |
| 7 | S8-TW-007 | (Optional) Admin UX for tweets |

---

## Notes

- **Batch:** Trustpilot uses 20 reviews per OpenAI call; we do the same for tweets (batch prompt → category, summary, importance_score).
- **Dedupe:** Unique on (firm_id, url) in firm_twitter_tweets; source_url in industry_news_items. Enforced in migration for firm_twitter_tweets.
- **Actor ID:** Kaito Cheapest – document in runbook; override via APIFY_TWITTER_ACTOR_ID if needed.
- **S9:** Email pipeline and public timelines remain in s9_scope / s9_tickets; do after this Twitter batch if desired.
