# Twitter/X Monitoring — Operations (S8)

How to operate and tune the **Twitter pipeline**: fetch tweets via Apify → batch AI (category, summary, importance) → store in `firm_twitter_tweets` and `industry_news_items`. The weekly digest can show up to 3 top tweets per firm per week (S8-TW-006b).

**See also:** [Twitter & weekly workflow (diagrams)](./twitter-and-weekly-workflow.md), [Intelligence Feed System Architecture](./intelligence-feed-system-architecture.md), [Content pipeline](./content-pipeline.md), [Daily scraper + weekly incidents & reports](./daily-scraper-weekly-incidents-reports-operations.md).

---

## Overview

1. **Fetch** – Apify runs a Twitter/X scraper (Kaito “Cheapest” Actor) for each monitored firm and once for industry search terms. Tweets are merged and deduped by ID.
2. **Ingest** – New tweets are deduped against the DB, then sent to OpenAI in batches (~20 per call) for category, summary, and importance score. Firm tweets → `firm_twitter_tweets`; industry tweets → `industry_news_items` with `source_type = 'twitter'` (saved as draft; admin can publish).
3. **Digest** – Up to 3 most important tweets per firm per week can be included in the weekly digest (by `importance_score`).

No manual approval is required for firm tweets to appear in the “top tweets” digest slot; industry Twitter items use the same review flow as other industry news if you want to gate them.

---

## Prerequisites

### APIFY_TOKEN

- **Where to get it:** [Apify Console](https://console.apify.com/account/integrations) → Integrations → API token. Create a token (read + run actors).
- **Where to set it:**
  - **Local / script:** Put `APIFY_TOKEN=...` in `.env` at repo root (do not commit). Scripts load it via `dotenv`.
  - **GitHub Actions:** Repo → Settings → Secrets and variables → Actions → New repository secret → name `APIFY_TOKEN`, value = your token.
- **Actor used:** **Kaito “Cheapest” Tweet Scraper** – `kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest`. Defined in `lib/apify/twitter-scraper.ts` (`DEFAULT_ACTOR_ID`). Override with `APIFY_TWITTER_ACTOR_ID` in env if you switch to another actor.

### Other env (fetch + ingest)

- **OPENAI_API_KEY** – Batch categorization (same as Trustpilot classifier).
- **NEXT_PUBLIC_SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY** – Writes to `firm_twitter_tweets` and `industry_news_items`.

---

## Config

Firms and search terms are defined in code (no DB table).

| What | File | What to edit |
|------|------|----------------|
| Firms and firm search terms | `config/twitter-monitoring.ts` | `TWITTER_MONITORING_FIRMS` – add/remove `{ firmId, searchTerms }`. |
| Industry search terms | `config/twitter-monitoring.ts` | `TWITTER_INDUSTRY_SEARCH_TERMS` – add/remove strings. |
| Limits (cost/volume) | `config/twitter-monitoring.ts` | `TWITTER_MAX_ITEMS_PER_TERM`, `TWITTER_MAX_ITEMS_PER_FIRM`, `TWITTER_MAX_ITEMS_INDUSTRY`. |

**Adding a new firm:**

1. Ensure the firm exists in `firm_profiles` (or your firms table) with the same `id` you will use.
2. In `config/twitter-monitoring.ts`, add an entry to `TWITTER_MONITORING_FIRMS`:
   ```ts
   {
     firmId: "newfirm",
     searchTerms: [
       "NewFirm",
       "from:NewFirm",
       "NewFirm prop firm",
     ],
   },
   ```
3. Deploy (or run the script locally). The next fetch will include the new firm.

**Adding industry keywords:** Append to `TWITTER_INDUSTRY_SEARCH_TERMS` in the same file.

---

## Usage

### 1. Per run: how many tweets we fetch

Each daily run (or manual `npx tsx scripts/twitter-fetch-job.ts`) fetches tweets in two ways:

| Stream | What runs | Default cap | Env override |
|--------|-----------|-------------|---------------|
| **Per firm** | One Apify run per firm in `TWITTER_MONITORING_FIRMS`. Each run uses that firm’s `searchTerms`; Apify returns up to **max per term** and we cap **total per firm**. | **150 tweets max per firm** (across all its terms). Up to **50 per search term**. | `TWITTER_MAX_ITEMS_PER_FIRM`, `TWITTER_MAX_ITEMS_PER_TERM` |
| **Industry** | One Apify run for all `TWITTER_INDUSTRY_SEARCH_TERMS`. | **100 tweets max total** for the industry run. Up to **50 per search term**. | `TWITTER_MAX_ITEMS_INDUSTRY`, `TWITTER_MAX_ITEMS_PER_TERM` |

- **Example (defaults):** 3 firms × up to 150 = up to 450 firm tweets; 1 industry run = up to 100 industry tweets. After merge and dedupe by tweet ID, total can be lower.
- Set the env vars in `.env` (local) or in the GitHub Action / Vercel env to change these limits.

### 2. How the AI classifier works (batch)

The classifier runs **only on new tweets** (after DB dedupe). It is **batched**, not one call per tweet.

| Aspect | Detail |
|--------|--------|
| **Where** | `lib/ai/categorize-tweets.ts` – `categorizeTweetBatch(tweets, { isIndustry })` |
| **Batch size** | **20 tweets per OpenAI call** (default). Configurable via `TWITTER_AI_BATCH_SIZE` (env); max 25. Same idea as Trustpilot’s batch classify. |
| **Flow** | Ingest splits new tweets into chunks of `TWITTER_AI_BATCH_SIZE`. Each chunk is sent in **one** request; the model returns **one array** of results in the same order (category, summary, importance_score per tweet). |
| **Firm tweets** | One prompt per batch; response: `{ category, summary, importance_score }` per tweet. No `mentioned_firm_ids` (not needed for firm tweets). |
| **Industry tweets** | Same batching; response also includes `mentioned_firm_ids` per tweet (which firms are mentioned). |
| **Model** | `gpt-4o-mini`. Retries with backoff on failure. |

So: e.g. 45 new firm tweets → 3 batch calls (20 + 20 + 5). Fewer API calls and lower cost than one call per tweet.

---

## Running manually

**Single command (fetch + ingest):**

From repo root with `.env` containing `APIFY_TOKEN`, `OPENAI_API_KEY`, and Supabase vars:

```bash
npx tsx scripts/twitter-fetch-job.ts
```

- Logs: fetch counts (total, per firm, industry), then ingest counts (firm/industry inserted and skipped).
- Optional env: `TWITTER_MAX_ITEMS_PER_FIRM`, `TWITTER_MAX_ITEMS_INDUSTRY`, `TWITTER_MAX_ITEMS_PER_TERM`, `TWITTER_AI_BATCH_SIZE` (default 20, max 25). See `.env.example`.

**Verification script (one search term, no ingest):**

```bash
npx tsx scripts/twitter-fetch-verify.ts
```

Uses the first industry term by default; useful to confirm Apify and token work without running the full pipeline.

---

## Cron

- **Workflow:** `.github/workflows/daily-step-twitter-fetch-ingest.yml`
- **Schedule:** Daily at **14:00 UTC** (6 AM PST), after Trustpilot daily steps (11–13 UTC).
- **Manual run:** GitHub → Actions → “Daily – Twitter Fetch + Ingest” → Run workflow → choose branch → Run.

**Changing frequency:** Edit the workflow file:

```yaml
on:
  schedule:
    - cron: "0 14 * * *"   # daily 14:00 UTC
```

Examples: `"0 6,18 * * *"` = 06:00 and 18:00 UTC; `"0 */12 * * *"` = every 12 hours. See [GitHub schedule syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule).

**Secrets required for cron:** `APIFY_TOKEN`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| “APIFY_TOKEN is not set” | Token missing in env or GitHub secret | Add to `.env` (local) or repo Actions secrets. |
| Apify run timeout / actor error | Actor down, rate limit, or bad request | Check [Apify Console](https://console.apify.com/) → Runs. Reduce `TWITTER_MAX_ITEMS_*` or retry later. |
| OpenAI rate limit / 429 | Too many batch calls in a short time | Wait and re-run; or lower `TWITTER_AI_BATCH_SIZE` (e.g. 10). |
| No rows inserted | All tweets already in DB (dedupe) | Expected if you re-run soon after a run. Check `firm_twitter_tweets` / `industry_news_items` for recent `source_url` / `url`. |
| Duplicate key / insert error | Unique on (firm_id, url) or source_url | Usually means a race or partial retry; safe to re-run (dedupe skips existing). |

**Where to see logs:**

- **GitHub Actions:** Actions → “Daily – Twitter Fetch + Ingest” → latest run → open the job → “Run Twitter fetch + ingest”. Logs show fetch counts and ingest inserted/skipped; errors (without tokens) appear in the step output.
- **Local:** Script prints to stdout; ensure `.env` is loaded (script uses `dotenv/config`).

**Temporarily disabling:**

- **Cron:** In the workflow file, comment out the `schedule` block (keep `workflow_dispatch` if you want manual runs only), or disable the workflow in GitHub Actions UI.
- No feature flag in app code; disabling is via workflow/schedule only.

---

## Cost

- **Apify:** Pay-per-result pricing; free tier ~$5 credits/month. Each run consumes credits based on number of tweets returned. Tune `TWITTER_MAX_ITEMS_PER_TERM`, `TWITTER_MAX_ITEMS_PER_FIRM`, and `TWITTER_MAX_ITEMS_INDUSTRY` to control volume.
- **OpenAI:** Batch categorization ~20 tweets per API call (gpt-4o-mini). Cost scales with number of new tweets per run. `TWITTER_AI_BATCH_SIZE` (default 20, max 25) controls batch size; fewer batches = fewer calls.

For design and spike context, see the sprint docs in `documents/current_sprint/` (e.g. `s8_scope.md`, `s8_twitter-design-decisions.md`).

---

**Last updated:** 2026-02
