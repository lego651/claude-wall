# S8 Scope: Twitter / X Monitoring Pipeline

**Goal:** Add a Twitter/X monitoring pipeline similar to the Trustpilot pipeline: fetch tweets via Apify → AI categorize/summarize → queue as draft in `firm_content_items` (firm-specific) or `industry_news_items` (industry) → admin reviews in existing queue → included in weekly digest.

**Provider:** Apify (recommended in [TWITTER-API-PROVIDERS-FREE-TRIALS-AND-CHOICE.md](../spikes/TWITTER-API-PROVIDERS-FREE-TRIALS-AND-CHOICE.md)). Actor: e.g. Kaito “Twitter/X Tweet Scraper (Pay-Per-Result, Cheapest)” – search by query, $0.25/1k tweets, trigger via REST API from cron.

**Phase:** Test with **3 firms only**; industry news stream in parallel. No need to onboard all firms yet.

---

## 1. Reference: How the Trustpilot Pipeline Works

| Step | Trustpilot | Twitter (target) |
|------|------------|------------------|
| **1. Fetch** | Daily 3 AM PST: Playwright scrapes Trustpilot per firm → rows into `firm_trustpilot_reviews` (raw, `classified_at` NULL). | Daily (or 2×/day): Cron calls Apify API with search terms per firm + industry → Apify returns tweet dataset. |
| **2. Store raw** | Dedupe by `trustpilot_url`; insert new reviews. | Normalize tweets; **dedupe by tweet URL** (or tweet ID) so we don’t insert same tweet twice. |
| **3. Classify** | Daily 4 AM PST: Select rows where `classified_at IS NULL` → OpenAI per review → write back category, summary, etc. | For each **new** tweet: run existing **AI categorizer** (`lib/ai/categorize-content.ts`) → get category, summary, confidence, tags (and for industry: `mentioned_firm_ids`). |
| **4. Queue** | Reviews live in `firm_trustpilot_reviews`; incidents derived later. | Insert into **`firm_content_items`** (firm tweets) or **`industry_news_items`** (industry tweets) with `source_type = 'twitter'`, `source_url = tweet URL`, **`published = false`** (draft). |
| **5. Publish** | N/A (reviews are always “published” for incident logic). | **Admin** uses existing **content review queue** (`/admin/content/review`) to approve/delete; approved items appear in weekly digest. |

So: **fetch (Apify) → normalize + dedupe → AI categorize → insert as draft → admin approve**. Same content pipeline as manual upload and (future) email; only the **source** is Twitter.

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
    → For each new tweet:
        - If from firm run  → firm_id known → AI categorize → insert firm_content_items (draft)
        - If from industry run → AI categorize (industry_news + mentioned_firms) → insert industry_news_items (draft)
    → Admin reviews in /admin/content/review
    → Approved items in weekly digest (existing flow)
```

**Dedupe:** Before insert, check if `source_url` (tweet permalink) already exists in `firm_content_items` (for that firm) or in `industry_news_items`. Skip if exists.

**Cost:** Apify free tier $5/month ≈ 20k tweets at $0.25/1k. With 3 firms × a few terms × 30–50 tweets/run and one industry run, we stay well under for testing.

---

## 6. Out of Scope for This S8 (Twitter) Batch

- Adding more than 3 firms (expand later).
- Reddit or other social sources (separate scope).
- S9 email pipeline and public timelines (separate; do later).
- Changing weekly digest format (Twitter items use same firm content / industry news sections as today).

---

## 7. Success Criteria

1. **Config** – List of 3 firms + search terms per firm; list of industry keywords. (Code or DB table.)
2. **Apify integration** – Script or job that runs the chosen Actor (e.g. Kaito) with configurable search terms and max items, returns normalized tweet list.
3. **Ingest** – For each new tweet: run existing AI categorizer, insert into `firm_content_items` or `industry_news_items` as draft, `source_type = 'twitter'`, `source_url` set; dedupe by URL.
4. **Cron** – Daily (or 2× daily) run of fetch + ingest (e.g. GitHub Actions or Vercel cron).
5. **Admin** – Twitter-sourced items appear in existing `/admin/content/review`; admin can approve/delete as for manual uploads.
6. **Runbook** – Short doc: how to set `APIFY_TOKEN`, which Actor ID, where to edit firm/industry terms, and how to run the job manually.
