# Option: Store industry tweets in firm_twitter_tweets (firm_id = 'industry')

**Status:** Design option (not implemented).  
**Context:** Pipeline today stores firm tweets in `firm_twitter_tweets` and industry tweets in `industry_news_items` (source_type='twitter'). This doc describes storing **all** Twitter-sourced tweets in one table.

---

## Clarification: pipeline covers both

The **Twitter pipeline** is one flow; we split by source into two destinations:

| Source | Apify terms | Table today | Digest |
|--------|-------------|-------------|--------|
| **Firm tweets** | Per-firm search terms | `firm_twitter_tweets` | Top 3 per firm (by importance_score) |
| **Industry tweets** | Industry keywords | `industry_news_items` (source_type='twitter') | After admin publish (incl. topic groups) |

Topic grouping and weekly-review apply to **industry** tweets (group by topic_title, approve at group level).

---

## Proposal: one tweets table, firm_id = 'industry'

Store industry tweets in **the same table** as firm tweets, with a sentinel `firm_id = 'industry'` (instead of `industry_news_items`).

**Benefits:**

- Single schema for all Twitter data: tweet_id, url, text, category, ai_summary, importance_score, topic_title.
- Topic grouping reads one table: `WHERE firm_id = 'industry'`.
- Clear mental model: “tweets” with firm_id = firm slug or `'industry'`.
- `industry_news_items` stays for **non-Twitter** industry content (manual, news, reddit).

**Requirements:**

1. **FK:** `firm_twitter_tweets.firm_id` references `firm_profiles(id)`. Add a row in `firm_profiles`: `id = 'industry'`, `name = 'Industry'` (or similar) so `firm_id = 'industry'` is valid.
2. **Published:** Firm rows don’t use a publish step; industry rows do. Add nullable `published` (and optional `published_at`) to `firm_twitter_tweets`, set for industry rows; digest uses `published = true` for industry only.
3. **topic_title:** Already on `industry_news_items` for grouping; add to `firm_twitter_tweets` if not already (we have it on industry_news_items; firm_twitter_tweets doesn’t have it today—we’d add it for industry in the same table).
4. **twitter_topic_groups:** Today `item_ids` are `industry_news_items.id`. If industry tweets move to `firm_twitter_tweets`, `item_ids` would store `firm_twitter_tweets.id` and `item_type` would still distinguish industry (or we keep one table and item_type = 'industry' → ids from firm_twitter_tweets where firm_id='industry').

**Naming:**

- Keep table name `firm_twitter_tweets` and allow `firm_id = 'industry'`; or rename to something like `twitter_tweets` if we want to avoid “firm” in the name. Either way, industry is `firm_id = 'industry'`.

**Migration path (if we do it):**

1. Add `firm_profiles` row: id='industry', name='Industry'.
2. Add to `firm_twitter_tweets`: `topic_title TEXT`, `published BOOLEAN DEFAULT NULL`, `published_at TIMESTAMPTZ` (nullable; used only when firm_id='industry').
3. Ingest: for industry tweets, insert into `firm_twitter_tweets` with firm_id='industry', published=false, topic_title from AI (instead of industry_news_items).
4. Topic grouping: read from `firm_twitter_tweets` where firm_id='industry', same grouping logic; write to `twitter_topic_groups` with item_ids = firm_twitter_tweets.id (and item_type or source table implied).
5. Weekly-review API/UI: resolve topic group item_ids from `firm_twitter_tweets` (url, text, etc.); bulk-approve sets published=true on those rows.
6. Digest: industry section reads from `firm_twitter_tweets` where firm_id='industry' AND published=true (and in week); keep reading `industry_news_items` for non-Twitter published items.
7. Optionally backfill or migrate existing industry Twitter rows from `industry_news_items` into `firm_twitter_tweets` (firm_id='industry') and then stop writing new industry tweets to `industry_news_items`.

---

## Recommendation

Using one table with `firm_id = 'industry'` is a reasonable simplification and keeps the pipeline clearly “all tweets here; industry is a special firm_id.” If you want to implement it, the steps above are the main schema and code changes.
