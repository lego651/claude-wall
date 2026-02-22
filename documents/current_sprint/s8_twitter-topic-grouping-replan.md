# S8 Tweet Pipeline Re-plan: Topic Grouping for Review (Trustpilot-style)

**Goal:** Make weekly review practical by grouping tweets into **1–3 topic cards** (like Trustpilot incidents) instead of 180+ individual items. Each card has a title, summary, and links to each source tweet for admin to verify.

**Reference:** [Trustpilot Incidents UI](../../../assets/image-383fc721-7363-4c5c-a5ab-64f9de35b057.png) – grouped incidents with "Review #7676" style links.

---

## 1. Problem

- **Weekly-review page** (`/admin/content/weekly-review`) shows:
  - Firm content (company news, rule changes, promotions)
  - **Industry news** – one row per item from `industry_news_items` (many from Twitter)
  - **Trustpilot incidents** – already grouped (one card = one incident = N reviews + links)
- Industry news + per-firm tweets often **> 180 items**, so admins cannot meaningfully review each one.
- Desired: **Group ≥3 “same topic” tweets into one card**, keep a **resource link to each tweet**, and **limit to 1–3 grouped topics** so review is practical.

---

## 2. Trustpilot Pattern (to mirror)

| Aspect | Trustpilot incidents | Target for tweets |
|--------|----------------------|-------------------|
| **Grouping** | Reviews grouped by **category** (e.g. payout_issue); ≥3 in window → one incident | Tweets grouped by **topic_title**; ≥3 same topic → one topic group |
| **Title** | AI-generated incident title (e.g. "Payout Requests Denied") | AI-generated topic title per group |
| **Summary** | AI summary of the cluster | AI summary of the tweet cluster |
| **Source links** | `review_ids` → "Review #7676", "Review #8464" | `item_ids` or `source_urls` → "Tweet #id" or open link |
| **Approval** | One checkbox per incident; uncheck = exclude from digest | One checkbox per topic group; approve = all items in group published (or group marked published) |
| **Table** | `firm_daily_incidents` (firm_id, week, title, summary, review_ids, published) | New: `twitter_topic_groups` (or `industry_topic_groups`) |

---

## 3. Approach Overview

1. **Per-tweet topic title** – During batch categorization (or a follow-up pass), assign each tweet a short **topic_title** (e.g. "Prop firm payout delays", "FundingPips rule change").
2. **Grouping job** – Weekly (or after ingest): group industry tweets by **normalized topic_title**; for each group with **≥3 tweets**, create one **topic group** with AI-generated summary and list of item IDs (or source_urls).
3. **New table** – Store topic groups (title, summary, item_ids, week, source: industry vs firm, published).
4. **Weekly-review API + UI** – Return **topic groups** for the week instead of (or in addition to) raw industry news; render like incidents: one card per group with "N tweets" and links to each tweet. Optionally show ungrouped tweets as "Other" or hide until we have a group.
5. **Digest** – Include approved topic groups in the digest (one block per group with summary + links), same pattern as incidents.

---

## 4. Data Model

### 4.1 Option A: New table `twitter_topic_groups` (recommended)

- **Scope:** Industry Twitter items only first; firm tweets can be added later with same pattern.
- **Table:** `twitter_topic_groups`
  - `id` SERIAL PRIMARY KEY
  - `topic_title` TEXT NOT NULL
  - `summary` TEXT
  - `item_type` TEXT ('industry' | 'firm')  -- industry = industry_news_items, firm = firm_twitter_tweets
  - `item_ids` JSONB NOT NULL  -- array of industry_news_items.id (or firm_twitter_tweets.id) for industry; for firm, firm_id scoped
  - `source_type` TEXT  -- 'twitter' (and later 'reddit' if needed)
  - `week_start` DATE NOT NULL  -- Monday of report week
  - `year` INT, `week_number` INT  -- for consistency with firm_daily_incidents
  - `firm_id` TEXT NULL  -- NULL for industry; set for firm-level tweet groups
  - `published` BOOLEAN DEFAULT FALSE (industry) or TRUE (auto-approved like incidents, optional)
  - `created_at`, `updated_at`
- **Dedupe:** One row per (topic_title_normalized, week_start, firm_id). Re-run job replaces groups for that week.

### 4.2 Storing topic_title on items (for grouping key)

- **industry_news_items:** Add column `topic_title` TEXT (nullable). Populated by batch AI (extend `categorizeTweetBatch` to return `topic_title`) or by a second AI pass that assigns topic to existing rows.
- **firm_twitter_tweets:** Same: add `topic_title` TEXT if we want to group firm tweets later.

---

## 5. AI Changes

### 5.1 Batch categorization (S8-TW-004) – extend response

- In `lib/ai/categorize-tweets.ts`, add to the batch prompt:
  - "For each tweet, also provide a **topic_title**: a short headline (3–8 words) that describes the main theme, e.g. 'Prop firm payout delays', 'FundingPips rule change'. Use consistent phrasing for tweets about the same topic so they can be grouped."
- Add `topic_title: string` to `TweetCategorizeResult` and persist to:
  - `industry_news_items` → new column `topic_title`
  - `firm_twitter_tweets` → new column `topic_title` (optional for phase 1)

### 5.2 Topic group summary (new)

- When creating a topic group (≥3 tweets with same normalized topic_title), call OpenAI once per group to generate a **summary** (like incident summary), or reuse the first tweet’s `ai_summary` and trim. Prefer one batched call for all groups in the week (like `generateIncidentSummariesBatch`).

---

## 6. Jobs & Schedule

| Job | When | What |
|-----|------|------|
| **Daily Twitter fetch + ingest** | Unchanged (14:00 UTC) | Writes to `firm_twitter_tweets` and `industry_news_items`; now also stores `topic_title` on each row. |
| **Weekly topic grouping** | After ingest, e.g. Sunday 06:00 UTC (before Weekly 1) or part of Weekly 1 | For report week: group `industry_news_items` (source_type=twitter) by normalized `topic_title`; for each group with ≥3 items, upsert row in `twitter_topic_groups` with AI summary and `item_ids`. Optionally same for `firm_twitter_tweets` per firm. |

---

## 7. Weekly-Review API & UI

### 7.1 API

- **GET /api/admin/content/weekly-review?week=...**
  - **Industry:** Instead of (or in addition to) raw `industryNews: industry_news_items[]`, return:
    - `industryTopicGroups: twitter_topic_groups[]` for the week (where item_type='industry'), each with `topic_title`, `summary`, `item_ids`, `published`.
    - Resolve `item_ids` to minimal display info (id, title, source_url) for "Tweet" links.
  - **Firm tweets (optional):** If we group firm tweets, return `firmTweetTopicGroups` per firm (same shape).

### 7.2 UI (mirror Trustpilot incidents)

- **Industry section:** Replace flat list of 180+ industry news cards with:
  - **Topic groups:** For each `industryTopicGroups` entry, one card:
    - Checkbox (approve / exclude from digest)
    - Topic title (e.g. "Prop firm payout delays")
    - Summary (AI)
    - "N tweets • Week X, Y"
    - Links: "Tweet #id" or "Open" using `source_url` for each item in `item_ids`
  - **Ungrouped:** Optionally a collapsible "Other industry news (not in a topic group)" for items that didn’t fit any group of ≥3, or hide for now.
- **Target:** 1–3 topic group cards so admin can approve in one pass.

### 7.3 Bulk approve

- When admin approves a **topic group**, either:
  - **Option A:** Set `twitter_topic_groups.published = true`; digest includes the group (summary + links). Individual `industry_news_items` in the group can stay `published = false` and only appear via the group in the digest, **or** we set all items in the group to `published = true` for consistency.
  - **Option B:** Set `published = true` on all `industry_news_items` whose id is in `item_ids`. Then digest can continue to read published industry_news_items as today; the group is only for review UX.
- **Recommendation:** Option B so digest logic stays simple (still "published industry_news_items in week"); topic groups are only for **grouped review and one-click approve all in group**.

---

## 8. Digest

- No change required if we use Option B above: digest still reads `industry_news_items` where `published = true`. Topic groups only reduce review burden.
- Optional enhancement: in the digest email, **cluster** published industry items by `topic_title` and render one block per topic (e.g. "Prop firm payout delays (3 tweets)" with links). That can be a later iteration.

---

## 9. Scope & Phasing

| Phase | Scope | Deliverables |
|-------|--------|--------------|
| **Phase 1** | Industry Twitter only | Add `topic_title` to batch AI and to `industry_news_items`; new table `twitter_topic_groups`; weekly grouping job; weekly-review API returns topic groups; UI shows topic group cards with tweet links; bulk approve publishes items in group. |
| **Phase 2** | Firm tweets (optional) | Same for `firm_twitter_tweets`: topic_title, group by topic per firm, show on weekly-review under each firm (1–3 cards). |
| **Phase 3** | Digest UX | Optionally show industry news in digest grouped by topic. |

---

## 10. Success Criteria

1. **Topic title** – Each industry tweet has a short AI-generated topic_title; stored on `industry_news_items`.
2. **Grouping** – Weekly job creates 1–3 topic groups per week when ≥3 tweets share the same (normalized) topic_title.
3. **Weekly-review** – Admin sees 1–3 topic cards (industry) with summary and links to each tweet; approving a group publishes all items in the group.
4. **No regression** – Digest still shows published industry news as today; only the path to “published” is via grouped review.

---

## 11. Open Decisions

- **Normalization of topic_title:** Lowercase + trim, or also stem/synonyms (e.g. "Payout delays" vs "Payout delay")? Start with lowercase + trim; expand if groups are too fragmented.
- **Minimum group size:** Strictly ≥3, or allow 2 with a flag? Start with ≥3.
- **Firm tweets in weekly-review:** Currently firm tweets are not on weekly-review (they go straight to digest top 3). If we add firm tweet topic groups, they would appear per firm like incidents; confirm product preference.
- **Unlisted items:** If an item has no topic_title or doesn’t belong to any group of ≥3, show in "Other" or hide from weekly-review? Recommend "Other" so nothing is lost.

---

## 12. References

- **Scope:** [s8_scope.md](./s8_scope.md)
- **Design:** [s8_twitter-design-decisions.md](./s8_twitter-design-decisions.md)
- **Trustpilot incident aggregator:** `lib/digest/incident-aggregator.ts` (group by category, AI title/summary, store review_ids)
- **Workflow diagram:** [twitter-and-weekly-workflow.md](../runbooks/twitter-and-weekly-workflow.md) (updated with grouping step)
