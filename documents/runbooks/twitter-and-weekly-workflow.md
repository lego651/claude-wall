# Twitter daily fetch & weekly reports — full workflow

How **per-firm tweets** and **industry tweets** flow from daily fetch into the weekly digest. All times UTC unless noted.

---

## 1. High-level: daily vs weekly

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DAILY (once per day, ~14:00 UTC)                                                │
│  One job: Twitter Fetch + Ingest                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        │  Writes to:
        │  • firm_twitter_tweets (per-firm tweets)
        │  • industry_news_items (industry tweets, source_type = 'twitter')
        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  WEEKLY (Sunday 07:00 + 08:00 UTC)                                               │
│  Weekly 1: Generate reports  →  Weekly 2: Send digest email                      │
└─────────────────────────────────────────────────────────────────────────────────┘
        │
        │  Reads from:
        │  • firm_twitter_tweets  →  top 3 tweets per firm (by importance_score)
        │  • industry_news_items  →  only rows where published = true
        ▼
   Subscriber inbox (one email per user, with all their subscribed firms)
```

**Important:** Per-firm tweets go straight into the digest (top 3 per firm). Industry tweets from Twitter are stored as **draft** (`published = false`); they only appear in the digest after an admin publishes them (same as other industry news).

**Topic grouping (implemented):** Industry tweets are **grouped** into 1–3 topic cards per week (like Trustpilot incidents). A weekly job (Sunday 6:00 UTC, GA “Weekly Step 0 – Twitter Topic Groups”) groups by `topic_title` (≥3 per topic) and writes to `twitter_topic_groups`. Admin approves at the group level on weekly-review. See [twitter-monitoring.md](./twitter-monitoring.md) and [s8_twitter-topic-grouping-replan.md](../current_sprint/s8_twitter-topic-grouping-replan.md).

---

## 2. Daily Twitter job: per-firm vs industry

The **single** daily job does both: fetch for **firms** and for **industry**, then ingest into two different tables.

```mermaid
flowchart LR
  subgraph config["Config (code)"]
    FIRMS[TWITTER_MONITORING_FIRMS]
    INDUSTRY[TWITTER_INDUSTRY_SEARCH_TERMS]
  end

  subgraph fetch["Fetch (Apify)"]
    A[Run Apify per firm]
    B[Run Apify once for industry terms]
    A --> MERGE[Merge & dedupe by tweet ID]
    B --> MERGE
  end

  subgraph output["Each tweet has"]
    SOURCE[source: 'firm' or 'industry']
    FIRM_ID[firmId set only for firm]
  end

  FIRMS --> A
  INDUSTRY --> B
  MERGE --> output
```

**After fetch**, every tweet is tagged as either:
- **Firm** – has `firmId` (e.g. fundednext, fundingpips), from that firm’s search terms.
- **Industry** – no `firmId`, from `TWITTER_INDUSTRY_SEARCH_TERMS` (e.g. "prop firm news", "Topstep").

Then **ingest** splits by that tag and writes to different tables:

```mermaid
flowchart TB
  subgraph input["Fetched tweets (in memory)"]
    T1[Tweet 1: firm fundednext]
    T2[Tweet 2: firm fundingpips]
    T3[Tweet 3: industry]
    T4[Tweet 4: industry]
  end

  subgraph dedupe["Dedupe (DB lookup)"]
    D1[Existing firm_twitter_tweets by firm_id + url]
    D2[Existing industry_news_items by source_url]
  end

  subgraph ai["Batch AI (OpenAI, ~20 per call)"]
    AI1[category, summary, importance_score]
    AI2[+ mentioned_firm_ids, topic_title for industry]
  end

  subgraph tables["Supabase tables"]
    FTT[(firm_twitter_tweets)]
    INI[(industry_news_items)]
  end

  T1 --> D1
  T2 --> D1
  T3 --> D2
  T4 --> D2
  D1 -->|new only| AI1
  D2 -->|new only| AI2
  AI1 --> FTT
  AI2 --> INI
```

| Destination | Used for | Rows from Twitter |
|-------------|----------|--------------------|
| **firm_twitter_tweets** | Per-firm tweets; digest picks top 3 per firm per week by `importance_score`. | All tweets with `source: 'firm'` (after dedupe). |
| **industry_news_items** | Industry news in digest; only **published** rows are shown. | All tweets with `source: 'industry'` (after dedupe), `source_type = 'twitter'`, `published = false` by default. |

So:
- **Per-firm tweets** → `firm_twitter_tweets` → weekly digest “Top tweets” (no publish step).
- **Industry tweets** → `industry_news_items` → appear in digest only after admin sets `published = true` (e.g. from Content Review).

---

## 3. Weekly reports: where Twitter data appears

Weekly has two steps: **generate reports** (Weekly 1) and **send digest email** (Weekly 2). Twitter data is **read** when building the digest (Weekly 2), not during report generation (Weekly 1).

```mermaid
flowchart TB
  subgraph weekly1["Weekly 1: Generate reports (Sunday 07:00 UTC)"]
    W1[Payouts, Trustpilot, incidents]
    W1 --> WR[(firm_weekly_reports)]
  end

  subgraph weekly2["Weekly 2: Send digest (Sunday 08:00 UTC)"]
    CACHE[Weekly digest cache]
    CACHE --> |"firm_content_items"| FC[Firm content]
    CACHE --> |"industry_news_items"| IN[Industry news]
    CACHE --> |"firm_twitter_tweets"| TT[Top 3 tweets per firm]
    FC --> BUILD[Build HTML per user]
    IN --> BUILD
    TT --> BUILD
    WR --> BUILD
    BUILD --> EMAIL[Resend: one email per user]
  end

  subgraph sources["Cache reads from DB (for report week)"]
    DB1[(firm_content_items)]
    DB2[(industry_news_items)]
    DB3[(firm_twitter_tweets)]
  end

  DB1 --> CACHE
  DB2 --> CACHE
  DB3 --> CACHE
```

**What gets into the digest:**

| Source | Table | Condition | In email |
|--------|--------|-----------|----------|
| Firm content (upload, etc.) | firm_content_items | `published = true`, content_date in week | Company news, rule changes, promotions |
| **Per-firm tweets** | **firm_twitter_tweets** | **tweeted_at in week** | **Top 3 per firm by importance_score** (“Top tweets”) |
| Industry news | industry_news_items | `published = true`, content_date in week | Industry section (includes Twitter if published) |

So:
- **Per-firm tweets** from `firm_twitter_tweets` are selected by week and importance; no publish flag.
- **Industry tweets** in `industry_news_items` only show up after an admin publishes them (e.g. in Content Review or Weekly Review).

---

## 4. Topic grouping for review

To avoid 180+ individual items on the weekly-review page, industry tweets will be **grouped by topic** (same idea as Trustpilot incidents).

```mermaid
flowchart LR
  subgraph stored["After ingest"]
    INI[(industry_news_items)]
  end

  subgraph grouping["Weekly topic grouping job"]
    JOB[Group by topic_title]
    JOB --> GROUPS[(twitter_topic_groups)]
  end

  subgraph review["Weekly-review page"]
    CARD1["Topic card 1: title + summary + N tweet links"]
    CARD2["Topic card 2: ..."]
    CARD3["Topic card 3: ..."]
  end

  INI -->|"topic_title on each row"| JOB
  GROUPS -->|"1–3 groups per week"| CARD1
  GROUPS --> CARD2
  GROUPS --> CARD3
```

| Step | What |
|------|------|
| **Ingest** | Batch AI adds **topic_title** (short headline) per tweet; stored on `industry_news_items`. |
| **Weekly job** | **Sunday 6:00 UTC** (GA “Weekly Step 0 – Twitter Topic Groups”): group industry tweets for **current week** by normalized topic_title; where **≥3 tweets** share a topic, create one row in **twitter_topic_groups** (title, summary, item_ids, week). Same week semantics as Trustpilot incidents. |
| **Weekly-review API** | Returns **topic groups** for the week; each group has links to each tweet (like “Review #7676” for incidents). |
| **Weekly-review UI** | Admin sees 1–3 topic cards; one checkbox per group; approve group → publish all items in that group. |

Result: admin reviews 1–3 grouped topics instead of 180+ items, with links to each source tweet for verification. See [twitter-monitoring.md](./twitter-monitoring.md).

---

## 5. End-to-end flow (daily + weekly)

```mermaid
flowchart TB
  subgraph daily["Daily (14:00 UTC)"]
    APIFY[Apify: firm searches + industry search]
    APIFY --> SPLIT{source?}
    SPLIT -->|firm| FTT[(firm_twitter_tweets)]
    SPLIT -->|industry| INI[(industry_news_items)]
  end

  subgraph weekly["Weekly (Sun 06:00 / 07:00 / 08:00 UTC)"]
    TOPIC["Topic grouping (Sun 6:00): group industry tweets → twitter_topic_groups"]
    GEN[Weekly 1: Generate reports]
    GEN --> WR[(firm_weekly_reports)]
    CACHE[Weekly 2: Build digest cache]
    FTT --> CACHE
    INI --> CACHE
    WR --> CACHE
    CACHE --> SEND[Send digest email]
  end

  INI -.-> TOPIC
  TOPIC -.->|"1–3 groups for weekly-review page"| REVIEW[Weekly-review UI]
  FTT -.->|"top 3 per firm, by importance"| CACHE
  INI -.->|"only published"| CACHE
```

---

## 6. Summary table

| What | Daily job | Table | Weekly digest |
|------|-----------|--------|----------------|
| **Per-firm tweets** | Fetch (firm terms) → ingest | firm_twitter_tweets | Top 3 per firm (auto, by importance_score) |
| **Industry tweets** | Fetch (industry terms) → ingest | industry_news_items (source_type=twitter, published=false) | Only if admin sets published=true |

**Cron:** One daily workflow runs fetch + ingest together (`scripts/twitter-fetch-job.ts` or GitHub Action `daily-step-twitter-fetch-ingest.yml`). Weekly steps are separate (Weekly 1 → Weekly 2) and already run on Sunday; they read from these tables when building the digest.

**Review UX:** The weekly topic-grouping job (Sun 6:00 UTC) creates 1–3 **topic groups** from industry tweets (≥3 same topic → one group). The weekly-review page shows these groups (like Trustpilot incidents) with links to each tweet. See §4 and [twitter-monitoring.md](./twitter-monitoring.md).
