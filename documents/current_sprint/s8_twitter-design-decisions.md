# S8 Twitter Pipeline: Design Decisions

**Summary:** Batch tweet categorization (like Trustpilot), dedicated `firm_twitter_tweets` table with importance scoring, and "up to 3 most important tweets per firm per week" in the digest.

---

## 1. Batch categorization (like Trustpilot)

**Trustpilot today:** Uses **batch** classification: 20 reviews per OpenAI call (`classifyReviewBatch`, `CLASSIFY_AI_BATCH_SIZE_DEFAULT = 20`, max 25). See `lib/ai/classifier.ts` and `lib/ai/batch-classify.ts`.

**Tweets:** We will **do the same** – batch tweets (e.g. 20 per call), not one-by-one. Add a tweet-specific batch prompt that returns, per tweet: `category`, `summary`, and **`importance_score`** (0–1). One OpenAI call per batch of 20 tweets; same cost/latency benefits as Trustpilot.

**Impl:** New function (e.g. in `lib/ai/` or `lib/ai/categorize-content.ts`) that accepts an array of tweet texts (and optional metadata), builds a batch prompt, returns array of `{ category, summary, importance_score }` in same order. Ingest job fetches tweets → dedupes → chunks into batches of 20 → calls batch categorizer → writes to DB.

---

## 2. Dedicated table for firm tweets (not `firm_content_items`)

**Why a dedicated table**

- **Trustpilot “incidents”** = we categorize reviews, then if **3–5 same-tagged reviews in a day** we flag a potential issue. So “importance” is derived from **volume + category**.
- **Tweets** = we may fetch 50+ per firm per day. We need a way to **select only important ones** for the weekly report. That implies:
  - Storing **per-tweet importance** (so we can rank and pick top 3).
  - A clear schema for tweets (tweet id, url, text, author, date, firm_id, category, summary, **importance_score**). Mixing these into `firm_content_items` would blur “manual/email content” with “tweets” and we’d still need a way to rank tweets.
- So we use a **dedicated table** `firm_twitter_tweets` (or `firm_tweets`) for firm-level tweet storage. Industry tweets can stay in `industry_news_items` (with optional importance later) or get a similar table later.

**Table: `firm_twitter_tweets` (proposed)**

- `id`, `firm_id`, `tweet_id` (external X id), `url`, `text`, `author_username`, `tweeted_at` (date of tweet), `category` (from AI), `ai_summary`, **`importance_score`** (float 0–1), `created_at`.
- Unique on `(firm_id, url)` or `(firm_id, tweet_id)` for dedupe.
- No `published` flag: tweets are always “in” the pool; the digest selects by importance (see below). Optionally we can add `published` later if we want admin to hide specific tweets.

**Industry tweets**

- For now keep using **`industry_news_items`** for industry-stream tweets (`source_type = 'twitter'`). We can add `importance_score` to that table later and do “top N industry tweets” in the digest if needed. Focus first on “up to 3 per firm.”

---

## 3. How we know which tweets are “important”

**Strategy: AI importance score**

- In the **same batch** that does category + summary, we ask the model for an **importance_score (0–1)** for each tweet: “How relevant/important is this tweet for the firm’s subscribers?”
  - High (e.g. 0.8–1): Breaking news, rule change, payout issue, major promotion, official firm announcement.
  - Low (e.g. 0.1–0.3): Minor mention, off-topic, spam, generic praise.
  - 0: Off-topic or noise (we can still store for analytics but exclude from “top 3”).
- We **don’t** use “3–5 same category per day” like Trustpilot incidents. We use **ranking**: per firm per week, take tweets in the week’s date range, **ORDER BY importance_score DESC**, take **up to 3** (can be 1 or 2 if fewer are above a threshold, or we always take top 3 even if low score and let design handle it).

**Weekly digest**

- When building the digest for a firm, in addition to existing firm content (from `firm_content_items`) and Trustpilot incidents, we:
  - Query **`firm_twitter_tweets`** for that `firm_id` where `tweeted_at` in the report week.
  - Order by **`importance_score` DESC**.
  - Limit **3**.
- Show that as a “Top tweets this week” or “Notable mentions” block (up to 3 items). If 0 tweets in range, show nothing.

---

## 4. Summary

| Topic | Decision |
|--------|----------|
| **Batch** | Yes – batch tweet categorization (e.g. 20 tweets per OpenAI call), like Trustpilot’s 20 reviews/call. |
| **Table** | Dedicated **`firm_twitter_tweets`** with `importance_score`; industry tweets stay in `industry_news_items` for now. |
| **Importance** | AI returns **importance_score (0–1)** in the same batch as category + summary. |
| **Digest** | Per firm: **up to 3** tweets for the week, chosen by **top importance_score** (ORDER BY importance_score DESC LIMIT 3). |

This gives a clear path: fetch → batch categorize (with importance) → store in `firm_twitter_tweets` → digest selects top 3 per firm per week.
