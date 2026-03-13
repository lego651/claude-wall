# S8 Scope: Twitter / X Monitoring Pipeline

**Goal:** Fetch tweets via Apify → **batch** AI categorize with **importance score** → store firm tweets in dedicated **`firm_twitter_tweets`** table → weekly digest shows **up to 3 most important tweets per firm per week** (no per-tweet admin approval). Industry tweets → `industry_news_items` (unchanged).

**Design details:** [s8_twitter-design-decisions.md](./s8_twitter-design-decisions.md) – batch like Trustpilot (20/call), dedicated table, importance_score, top-3-per-firm-per-week.

**Provider:** Apify (recommended in [TWITTER-API-PROVIDERS-FREE-TRIALS-AND-CHOICE.md](../spikes/TWITTER-API-PROVIDERS-FREE-TRIALS-AND-CHOICE.md)). Actor: e.g. Kaito “Twitter/X Tweet Scraper (Pay-Per-Result, Cheapest)” – search by query, $0.25/1k tweets, trigger via REST API from cron.

**Phase:** Test with **3 firms only**; industry news stream in parallel. No need to onboard all firms yet.

---

## 1. Reference: How the Trustpilot Pipeline Works (and how Twitter differs)

| Step | Trustpilot | Twitter (this pipeline) |
|------|------------|--------------------------|
| **1. Fetch** | Daily 3 AM PST: Playwright scrapes Trustpilot per firm → `firm_trustpilot_reviews` (raw). | Daily: Cron calls Apify with search terms per firm + industry → raw tweet list. |
| **2. Classify** | **Batch:** 20 reviews per OpenAI call → category, severity, summary. | **Batch:** ~20 tweets per OpenAI call → category, summary, **importance_score (0–1)**. Same pattern as Trustpilot. |
| **3. Store** | Write back to `firm_trustpilot_reviews`. Incidents = 3–5 same category per day. | Firm tweets → **`firm_twitter_tweets`** (dedicated table). Industry tweets → **`industry_news_items`** with `source_type = 'twitter'`. |
| **4. Digest** | Incidents derived from review counts; report includes incident summary. | **Per firm:** query `firm_twitter_tweets` for the week, **ORDER BY importance_score DESC, LIMIT 3**. Show “Top tweets” (up to 3). No admin approval step. |

So: **fetch → dedupe → batch categorize (with importance) → store in `firm_twitter_tweets` / `industry_news_items` → digest picks top 3 per firm by importance**. We do **not** put firm tweets into `firm_content_items` or the review queue; importance drives what appears in the report.

---

## 2. Firms to Monitor (Test – 3 Only)

| Firm ID | Display name | Notes |
|---------|--------------|--------|
| **fundednext** | Funded Next | |
| **fundingpips** | FundingPips | |
| **alphacapitalgroup** | Alpha Capital Group | |

Config or code will list these three for the Twitter job; we can expand to all firms later.

---

## 3. Search Strategy: Multiple Keywords per Firm

We **do not** rely on firm name only. Each firm gets **multiple search terms** to capture:

- Official posts (e.g. `from:FundingPips`)
- Mentions and discussions (e.g. "FundingPips payout", "FundingPips scam")
- Slight name variants ("Funding Pips", "Funded Next")

Suggested terms (tunable in config):

**Funded Next (fundednext)**  
- `Funded Next`, `FundedNext`, `from:FundedNext` (if handle exists), `Funded Next prop firm`, `Funded Next payout`

**FundingPips (fundingpips)**  
- `FundingPips`, `Funding Pips`, `from:FundingPips`, `FundingPips prop firm`, `FundingPips payout`

**Alpha Capital Group (alphacapitalgroup)**  
- `Alpha Capital Group`, `Alpha Capital`, `ACG prop`, `from:AlphaCapitalGroup` (or actual handle), `Alpha Capital Group prop firm`

Implementation: one Apify run per **search term** (or batch of terms per Actor input, depending on Actor). Cap **max items per run** (e.g. 30–50 per term) to control cost and volume. Dedupe by tweet ID when merging results for the same firm.

---

## 4. Industry News Monitoring

Separate stream: **industry-wide** keywords, not tied to a single firm. Results go into **`industry_news_items`** with `source_type = 'twitter'`; AI fills **`mentioned_firm_ids`** (e.g. Topstep, FundingPips).

Suggested keywords:

- **prop firm**, **prop firms**, **prop firm news**, **prop firms news**
- **Topstep** (leading firm we don’t have as a firm yet – still valuable for industry)
- **funded trading**, **prop trading news**, **funded account**
- **prop firm regulation**, **prop firm payout** (optional)

One or more Apify runs with these queries; each tweet is categorized by AI as industry (or noise); we only insert those classified as industry/news and store with `mentioned_firm_ids` when relevant.

---

## 5. Data Flow (High Level)

```
Apify (search terms per firm + industry terms)
    → Raw tweet dataset (id, text, author, url, date, …)
    → Normalize & dedupe (by tweet id / source_url)
    → Firm tweets: batch AI (e.g. 20 per call) → category, summary, importance_score
        → Insert into firm_twitter_tweets (dedupe by firm_id + url)
    → Industry tweets: batch AI → category, summary, mentioned_firm_ids
        → Insert into industry_news_items (source_type = 'twitter'; optional importance later)
    → Weekly digest: per firm, select top 3 from firm_twitter_tweets by importance_score for the week
```

**Dedupe:** Before insert, check `firm_twitter_tweets` for (firm_id, url) and `industry_news_items` for source_url. Skip if exists.

**Importance:** AI scores each tweet 0–1 (“how important for the firm’s subscribers?”). Digest shows **up to 3** per firm per week (can be 1 or 2 if fewer are above threshold or we simply take top 3).

**Cost:** Apify free tier $5/month ≈ 20k tweets at $0.25/1k. Batch OpenAI (20 tweets/call) keeps token cost low (~same order as Trustpilot classify).

---

## 6. Out of Scope for This S8 (Twitter) Batch

- Adding more than 3 firms (expand later).
- Reddit or other social sources (separate scope).
- S9 email pipeline and public timelines (separate; do later).
- Per-tweet admin approval queue for firm tweets (we use importance_score and top-3 instead).

---

## 7. Success Criteria

1. **Config** – List of 3 firms + search terms per firm; list of industry keywords. (Done: config file.)
2. **Apify integration** – Job runs Actor, returns normalized tweet list. (Done: lib/apify/twitter-scraper.)
3. **Dedicated table** – `firm_twitter_tweets` with tweet id, firm_id, url, text, author, tweeted_at, category, ai_summary, **importance_score**; dedupe by (firm_id, url).
4. **Batch ingest** – Firm tweets: batch AI (e.g. 20/call) → category, summary, importance_score → insert into `firm_twitter_tweets`. Industry tweets: batch AI → insert into `industry_news_items` with source_type = 'twitter'.
5. **Cron** – Daily run of fetch + ingest (e.g. GitHub Actions).
6. **Digest** – Weekly report includes “Top tweets” per firm: up to 3 from `firm_twitter_tweets` for the week, ordered by importance_score DESC.
7. **Runbook** – How to set `APIFY_TOKEN`, Actor ID, config, manual run, troubleshooting.
