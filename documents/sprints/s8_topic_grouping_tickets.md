# S8 Topic Grouping Tickets (Twitter review UX)

**Goal:** Group industry tweets into 1–3 topic cards on weekly-review (like Trustpilot incidents) so admins can approve in one pass.  
**Re-plan:** [s8_twitter-topic-grouping-replan.md](./s8_twitter-topic-grouping-replan.md)

---

## Ticket list

| # | Ticket | Description | Status |
|---|--------|-------------|--------|
| 1 | **TG-001** | Migration: add `topic_title` to `industry_news_items`; create `twitter_topic_groups` table | ✅ Done |
| 2 | **TG-002** | AI: add `topic_title` to batch prompt and result in `categorize-tweets.ts` | ✅ Done |
| 3 | **TG-003** | Ingest: persist `topic_title` when inserting industry tweets | ✅ Done |
| 4 | **TG-004** | Topic grouping job: group industry tweets by topic_title (≥3), create groups with AI summary | ✅ Done |
| 5 | **TG-005** | Weekly-review API: return `industryTopicGroups` with resolved item links | ✅ Done |
| 6 | **TG-006** | Weekly-review UI: show industry topic group cards (checkbox, title, summary, N tweets, links) | ✅ Done |
| 7 | **TG-007** | Bulk approve: when approving a topic group, set published on all items in group | ✅ Done |

---

## TG-001: Migration

- Add `topic_title TEXT` to `industry_news_items` (nullable).
- Create `twitter_topic_groups` with: id, topic_title, summary, item_type ('industry'), item_ids (JSONB array of int), source_type ('twitter'), week_start, year, week_number, firm_id (NULL for industry), published (DEFAULT false), created_at, updated_at.
- Indexes: (week_start, item_type), (published, week_start). RLS for admins.

## TG-002: AI topic_title

- In `lib/ai/categorize-tweets.ts`: add to prompt "topic_title: short headline 3–8 words, consistent for same topic"; add `topic_title: string` to `TweetCategorizeResult`; parse and normalize (trim, max length) in response loop.

## TG-003: Ingest persist topic_title

- In `lib/twitter-ingest/ingest.ts`: when inserting into `industry_news_items`, set `topic_title: r.topic_title ?? null` from batch result.

## TG-004: Topic grouping job

- New script e.g. `scripts/run-twitter-topic-groups.ts` (or lib + script).
- For given week: select industry_news_items where source_type='twitter' and content_date in week; group by normalized topic_title (lowercase, trim); for each group with count ≥ 3, generate summary (batch AI or first item summary), insert/upsert into twitter_topic_groups with item_ids. Delete existing groups for that week first (like incident aggregator).

## TG-005: Weekly-review API

- In GET `/api/admin/content/weekly-review`: fetch twitter_topic_groups for week where item_type='industry'; resolve item_ids to [{ id, title, source_url }]; add industryTopicGroups to response. Keep industryNews for now (ungrouped or fallback).

## TG-006: Weekly-review UI

- Industry section: if industryTopicGroups.length > 0, render topic group cards (like incidents): checkbox, topic_title, summary, "N tweets • Week X, Y", links (Tweet #id or Open) for each item. Else fall back to flat industry list.

## TG-007: Bulk approve topic groups

- In bulk-approve API: accept topicGroupIds; for each id, get item_ids from twitter_topic_groups, set published=true (and published_at) on those industry_news_items. Optionally set published on twitter_topic_groups row for consistency.
