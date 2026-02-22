# S8 Tickets: Twitter / X Monitoring Pipeline

**Scope:** [s8_scope.md](./s8_scope.md)  
**Order:** Implement in ticket order below. Config and Apify client first, then ingest, then cron and runbook.

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

- [ ] Config or table exists and is used by the fetch job (S8-TW-002) so we can add/change terms without code change.
- [ ] At least 3–5 terms per firm and 5+ industry keywords as in scope.

---

## S8-TW-002: Apify client – run Twitter Actor and return normalized tweets

**Goal:** Reusable way to run the chosen Apify Actor (e.g. Kaito “Cheapest” Tweet Scraper) with a list of search terms and a max-items cap, and return a normalized list of tweets (id, text, url, author, date).

**Tasks:**

1. **Env** – Document `APIFY_TOKEN` in `.env.example` and runbook; job must read it at runtime.
2. **Client** – Add `lib/apify/` (or `lib/twitter-apify.ts`): function that accepts `searchTerms: string[]`, `maxItemsPerTerm?: number`, and optionally `maxItemsTotal`. Calls Apify REST API to start run, polls until done, fetches dataset, normalizes to a common shape (e.g. `{ id, text, url, authorUsername, createdAt }`). Actor ID should be configurable (env or config).
3. **Actor input** – Map our search terms to the Actor’s input schema (e.g. Kaito uses `searchTerms` array and `maxItems`; see Apify Actor docs). Handle one run per term or one run with multiple terms depending on Actor.
4. **Errors** – If Apify run fails or times out, log and return partial results or empty; don’t crash the full job.

**Acceptance:**

- [ ] Unit or integration test: mock Apify response and assert normalized output shape.
- [ ] Readme or runbook: how to get `APIFY_TOKEN`, which Actor ID is used, and how to run the client manually (e.g. small script that runs for one firm and logs tweets).

---

## S8-TW-003: Fetch job – run Apify for monitored firms and industry

**Goal:** Script or entrypoint that (1) reads Twitter monitoring config (S8-TW-001), (2) for each monitored firm runs Apify with that firm’s search terms, (3) runs Apify once for industry keywords, (4) aggregates and dedupes by tweet ID, (5) outputs or passes a single list of “raw tweets” with a flag or source indicating “firm” (with firm_id) vs “industry”.

**Tasks:**

- For each of the 3 firms: call Apify client with firm’s `searchTerms`, cap `maxItems` (e.g. 30–50 per term or 100 per firm).
- One run for industry: call Apify with industry keywords, cap total items (e.g. 100).
- Merge all tweets and dedupe by tweet `id` (or URL); attach `firm_id` for firm-sourced tweets and `source: 'industry'` for industry-sourced.
- Output: array of `{ tweetId, text, url, author, date, firmId?: string, source: 'firm'|'industry' }` to be consumed by ingest (S8-TW-004).

**Acceptance:**

- [ ] Running the script with valid `APIFY_TOKEN` and config produces a list of tweets; no duplicate tweet IDs in the list; firm tweets have `firmId`, industry tweets have `source: 'industry'`.
- [ ] Configurable max items per firm/industry to avoid blowing Apify credits (env or config).

---

## S8-TW-004: Ingest – normalize tweet → AI categorize → insert draft (firm or industry)

**Goal:** For each tweet from the fetch job: (1) skip if we already have this tweet in DB (dedupe by `source_url`), (2) run existing AI categorizer (`lib/ai/categorize-content.ts`), (3) insert into `firm_content_items` (firm tweets) or `industry_news_items` (industry tweets) as **draft** (`published = false`), with `source_type = 'twitter'`, `source_url = tweet permalink`, `content_date` from tweet date.

**Tasks:**

1. **Dedupe** – Before insert, check:
    - Firm: `firm_content_items` where `firm_id = X` and `source_url = tweetUrl`. Skip if exists.
    - Industry: `industry_news_items` where `source_url = tweetUrl`. Skip if exists.
2. **Title** – Use AI-returned title; fallback to truncated tweet text (e.g. first 80 chars).
3. **Firm content** – Insert into `firm_content_items`: `firm_id`, `raw_content = tweet text`, `source_url`, `source_type = 'twitter'`, `content_type` from AI (or map to company_news/rule_change/promotion/other), `ai_summary`, `ai_category`, `ai_confidence`, `ai_tags`, `content_date` (from tweet), `published = false`.
4. **Industry news** – Insert into `industry_news_items`: `title`, `raw_content`, `source_url`, `source_type = 'twitter'`, AI fields, `mentioned_firm_ids` from AI, `content_date`, `published = false`.
5. **Idempotency** – Re-running the same fetch output should not create duplicate rows (dedupe by `source_url`).
6. **Rate limit** – Optionally throttle AI calls (e.g. 1 req/sec) to avoid OpenAI rate limits when ingesting many tweets.

**Acceptance:**

- [ ] New tweets from fetch job are inserted as draft; existing tweet URL is skipped.
- [ ] Firm tweets appear in `firm_content_items` with correct `firm_id` and `source_type = 'twitter'`.
- [ ] Industry tweets appear in `industry_news_items` with `source_type = 'twitter'` and `mentioned_firm_ids` when AI returns them.
- [ ] Admin can see and approve/delete these items in existing `/admin/content/review`.

---

## S8-TW-005: Cron – schedule daily (or 2× daily) Twitter fetch + ingest

**Goal:** Run the Twitter pipeline automatically (fetch → ingest) on a schedule without manual steps.

**Tasks:**

- Add a **cron entrypoint** that: (1) runs the fetch job (S8-TW-003), (2) runs the ingest step (S8-TW-004) on the fetched tweets. Can be one script that does both, or two steps in one workflow.
- Schedule via **GitHub Actions** (e.g. `daily-step-twitter-fetch-ingest.yml`) or **Vercel Cron** (e.g. `app/api/cron/twitter-fetch/route.ts` that calls the same logic). Prefer same pattern as Trustpilot (GitHub Actions) for consistency.
- **Secrets:** `APIFY_TOKEN` in GitHub secrets or Vercel env; Supabase available for ingest (service role or existing cron env).
- **Logging** – Log run start/end, number of tweets fetched, number inserted/skipped, and any Apify/OpenAI errors (without exposing tokens).

**Acceptance:**

- [ ] Cron runs at least once per day (e.g. 6 AM UTC or after Trustpilot classify).
- [ ] On success, new Twitter-sourced drafts appear in the content review queue; no duplicate rows for same tweet URL.
- [ ] On failure (Apify down, token invalid), job fails visibly (log/alert) and does not corrupt DB.

---

## S8-TW-006: Runbook – Twitter monitoring operations

**Goal:** Short runbook so anyone can operate and tune the Twitter pipeline.

**Contents:**

1. **Overview** – What the pipeline does (fetch from Apify → ingest as draft → admin approves).
2. **Prerequisites** – `APIFY_TOKEN` (where to get it, where to set it); which Apify Actor is used and how much it costs.
3. **Config** – Where firm and industry search terms are defined (file or table); how to add a new firm or keyword.
4. **Running manually** – How to run the fetch + ingest script locally or via a one-off API call (if implemented).
5. **Cron** – Where the schedule is defined (workflow file or Vercel cron), and how to change frequency.
6. **Troubleshooting** – Common errors (invalid token, Apify timeout, OpenAI rate limit); where to see logs; how to temporarily disable (e.g. comment out workflow or flip a flag).
7. **Cost** – Reminder: Apify $5 free credits/month; approximate tweet volume for current config; link to spike doc for provider choice.

**Acceptance:**

- [ ] Runbook lives in `documents/runbooks/` (e.g. `twitter-monitoring.md`) and is linked from main README or intelligence-feed runbook.
- [ ] New dev can follow it to set up token, run one manual fetch, and understand where to edit keywords.

---

## S8-TW-007 (optional): Admin UX hint for Twitter source

**Goal:** In the content review queue, make it easy to see that an item came from Twitter (e.g. badge or filter).

**Tasks:**

- In `/admin/content/review`, show **source_type** (e.g. “Twitter”) and **source_url** (link) for each row so admins can open the tweet. If the list already shows source type/URL, ensure “twitter” is displayed clearly.
- Optional: filter by `source_type = 'twitter'` to review only Twitter-sourced items.

**Acceptance:**

- [ ] Review queue shows source type and clickable source URL; Twitter items are clearly identifiable.
- [ ] Optional filter by source = Twitter works if implemented.

---

## Ticket order summary

| Order | Ticket | What |
|-------|--------|------|
| 1 | S8-TW-001 | Config: firms + industry keywords |
| 2 | S8-TW-002 | Apify client: run Actor, normalize tweets |
| 3 | S8-TW-003 | Fetch job: run Apify for 3 firms + industry, dedupe |
| 4 | S8-TW-004 | Ingest: AI categorize → insert draft (firm_content_items / industry_news_items) |
| 5 | S8-TW-005 | Cron: schedule fetch + ingest daily |
| 6 | S8-TW-006 | Runbook for Twitter monitoring |
| 7 | S8-TW-007 | (Optional) Admin UX: show Twitter source in review queue |

---

## Notes

- **Dedupe key:** Use tweet permalink as `source_url`; unique per tweet. No schema change required if we “select before insert” by `source_url` (+ `firm_id` for firm content). If we later want to enforce at DB level, we can add a unique constraint on `(firm_id, source_url)` for `firm_content_items` and on `source_url` for `industry_news_items` (migration).
- **Actor ID:** Kaito Cheapest Actor ID (Apify) – document in runbook; e.g. `kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest`. Can be overridden via env for testing.
- **S9:** Email pipeline and public timelines remain in s9_scope / s9_tickets; do after this Twitter batch if desired.
