# Intelligence Feed & Digest Strategy

**Context:** Strategic planning for `/propfirms/{firm}/intelligence` page and weekly email digest product.
**Date:** 2026-03-07

---

## 1. Intelligence Feed Design Philosophy

### The Core Tension

The page currently shows mostly negative/incident signals. The question: should we intentionally balance positive and negative, or let data speak for itself?

**Answer: Let the data speak, but classify everything.**

Our product promise is *unbiased evaluation*. That means:
- A firm with genuinely great payout performance should show positive signals prominently
- A firm with systemic issues should surface red flags clearly
- We do not editorialize — we surface what the data says

Showing only incidents would make us a complaint aggregator, not an intelligence platform. It would also be inaccurate: if a firm is paying out fast and consistently, that is a signal. Suppressing it would be a bias in itself.

### What to Show

Show all signal types, clearly tagged:

| Signal Type | Color | Examples |
|---|---|---|
| Positive / Operational | Green | Fast payouts, improved support, new funding levels, rule improvements |
| Negative / Incident | Red | Payout delays, account blocking, rule changes hurting traders, KYC failures |
| Informational / Neutral | Grey | Promotions, new product launches, policy announcements, platform updates |
| Reputation | Amber | Mixed sentiment patterns, contested claims, community debates |

The current feed already has this structure (colored dots + OPERATIONAL/REPUTATION tags). Lean into it further. The composition of signals will naturally reflect the firm's actual behavior — that is the unbiased output.

---

## 2. X/Twitter Data Ingestion Strategy (Revised)

### Current Approach — Problem

The pipeline uses **Apify's Kaito actor** (pay-per-result scraper, not the X API directly). Today it runs one Apify actor run per firm + one industry run. With 3 firms: 4 runs/day. As firm count grows, so does cost linearly — this is the scaling problem.

Additionally, per-firm keyword searches using generic brand names produce noise and miss official account posts that don't contain industry keywords.

### Recommended Approach — Hybrid 2-Run Model

Replace per-firm keyword searches with a fixed **2-run model regardless of how many firms are tracked:**

**Run 1 — Official Accounts (high-signal, firm-attributed)**
Construct a single Apify query: `from:FundedNext OR from:FundingPips OR from:FTMO OR from:Topstep ...`
- One run covers all monitored firm official accounts
- Direct firm attribution — no guesswork
- Captures announcements, rule changes, promotions, firm responses
- Scales to any number of firms without additional runs

**Run 2 — Industry Keywords (community discussion)**
Keep the existing industry keyword search with expanded terms
- Captures trader community discussion, complaints, cross-firm comparisons
- After fetch: scan tweet text + use AI-extracted `mentioned_firm_ids` to attribute tweets to specific firms
- Tweets mentioning a specific firm get a `firm_twitter_tweets` row for that firm; tweets with no firm mention remain industry-level

This reduces cost from `N+1` runs to always `2` runs, and improves signal quality by guaranteeing firm official account coverage.

### Attribution for Community Tweets

The AI already extracts `mentioned_firm_ids` for industry tweets — this field exists in the schema and the categorization pipeline. The missing step is fanning out industry tweets with `mentioned_firm_ids` into additional `firm_twitter_tweets` rows (one per mentioned firm). This is partially built.

### What We'd Gain vs. Lose

| | Current (N+1 runs) | Hybrid (2 runs) |
|---|---|---|
| Apify cost | Scales with firm count | Fixed at 2 runs |
| Official account posts | Via `from:` per firm | Via combined `from:` query |
| Community discussion | Via brand keywords | Via industry run |
| Cross-firm comparison tweets | Partially captured | Better — industry run surfaces them |
| Niche brand terms (e.g. "ACG prop") | Captured per-firm | Missed unless added to industry terms |
| Coverage as firm count grows | Degrades (cost) | Stable |

### Display: Grouped Topics, Not Individual Tweets

Regardless of ingestion approach, the display layer should show **grouped topics, not individual tweets.**

Each topic card:
- Topic label (e.g., "Payout Processing", "KYC Issues", "Scaling Rules Change")
- Volume: number of posts/accounts discussing it this week
- Sentiment: positive / negative / mixed
- 4–6 representative tweet excerpts as references (same format as Trustpilot signal cards)
- Integrated into the main intelligence feed, not a separate tab

Add "Social" as a filter type in the existing "All Types" filter dropdown.

### Files to Change for Hybrid Model

- `config/twitter-monitoring.ts` — replace per-firm `searchTerms` arrays with a `firmHandles` list; build the `from:` union query at runtime
- `lib/twitter-fetch/fetch-job.ts` — replace per-firm loop with one combined `from:` run + one industry run
- `lib/twitter-ingest/ingest.ts` — fan out industry tweets with `mentioned_firm_ids` into firm-attributed rows

---

## 3. Trustpilot Weekly Score Breakdown

### The Problem

Trustpilot's overall score (e.g., 4.5) is a lifetime aggregate. A firm that was great in 2023 but has been receiving 2-star reviews for the past 3 weeks still shows 4.5 overall. This masks critical real-time deterioration.

### The Signal We Want

"This week: 3.2 vs. lifetime: 4.5" — this delta is a major red flag. If it persists across 2-3 weeks, it should trigger an intelligence signal in the feed.

### Feature Concept: Score Momentum

- Weekly rolling average score (last 7 days) vs. lifetime average
- 8-week trend sparkline on the firm's intelligence sidebar
- Alert trigger: when weekly score deviates >0.5 from lifetime average for 2+ consecutive weeks → generates an intelligence signal in the feed automatically

### Technical Findings (from tech-lead spike)

Good news: **most of the infrastructure already exists.**

- Individual reviews are stored in `firm_trustpilot_reviews` with a `review_date` column (timestamps are available)
- Weekly `avgRating` and `ratingChange` are already computed and stored in `firm_weekly_reports.report_json` as part of the email digest pipeline (`lib/digest/generator.ts`)
- This means a week-over-week trend API can be built **today with zero schema changes** by reading from `firm_weekly_reports`

**The one missing piece:** there is no stored "lifetime overall" Trustpilot score. The overall 4.5 is not fetched or stored anywhere — if displayed, it would be computed from recent reviews only. This is the critical gap for the "this week vs. overall" comparison.

**Critical constraint:** Reviews are deleted after 30 days (rolling retention). Lifetime averages cannot be computed from the reviews table — the data is systematically pruned.

### Implementation Path

**What can be built now (no schema changes):**
- `/api/v2/propfirms/[id]/trustpilot-trend` — reads last 8 weeks of `avgRating` from `firm_weekly_reports.report_json`
- Frontend sparkline using this data

**What requires a migration:**
- Add `trustpilot_overall_score NUMERIC(3,1)` and `trustpilot_overall_review_count INT` to `firm_profiles`
- Extend `lib/scrapers/trustpilot.ts` to parse Trustpilot's JSON-LD structured data (`aggregateRating.ratingValue`) from the firm's Trustpilot page — this is publicly available
- Update `scripts/backfill-firm-trustpilot-reviews.ts` to write these values after each daily scrape

### Sprint Tickets

1. **Migration:** Add `trustpilot_overall_score` / `trustpilot_overall_review_count` to `firm_profiles` (`migrations/32_add_firm_trustpilot_overall_score.sql`)
2. **Scraper:** Parse JSON-LD aggregate rating from Trustpilot listing page in `lib/scrapers/trustpilot.ts`
3. **Backend:** Create `/api/v2/propfirms/[id]/trustpilot-trend` endpoint from `firm_weekly_reports`
4. **Frontend:** Score momentum sparkline in intelligence sidebar (8-week view + current week vs. overall delta)
5. **Intelligence signal:** Auto-generate feed signal when weekly score deviates >0.5 from overall for 2+ weeks

Complexity: **Medium.** The weekly aggregation pipeline is already built — the main work is scraping the aggregate score and exposing the trend via a new API route.

**Coverage note:** Only 10 firms currently have a `trustpilot_url` set. This feature only works for those firms at launch.

---

## 4. Weekly Email Digest — Free vs. Paid

### Product Concept

Two tiers of the weekly digest:

**Free — Industry Digest**
Covers the whole prop firm industry: notable incidents, rule changes, payout trends, promotions, and firm news across all firms.

**Paid — Firm Digest**
Covers industry-level important news (curated, not exhaustive) plus deep coverage of the specific firms the user follows.

### Strategic Analysis

#### Free Tier

Strengths:
- Low friction, broad reach — good for top-of-funnel acquisition
- Positions PropPulse as the industry's weekly briefing, not just a firm-specific tool
- Drives users to the platform to see more detail

Risks:
- Covering 50+ firms in a single digest produces shallow, noisy content
- No personalization = low email open rates over time
- Commodity risk: generic prop firm newsletters already exist

Verdict: The free tier works as an **acquisition channel**, not a retention driver. It should be short (5-10 signals, industry-wide), not comprehensive. Quality over completeness.

#### Paid Tier

Strengths:
- High perceived value: "Here's exactly what happened at FTMO and FundedNext this week, because those are the firms you trade with"
- Creates lock-in: the more firms a user follows, the more indispensable the digest
- Clear differentiation from anything else in the market
- Natural upsell path from free: follow a firm on free tier → see teaser → upgrade for full coverage

Risks:
- Minimum viable personalization requires users to follow ≥2 firms
- Need sufficient signal volume per firm per week to justify depth (smaller firms may have sparse data)

Verdict: The paid tier is the **retention and monetization engine**. This is the core product value, not a premium add-on.

### Recommended Positioning

| | Free | Paid |
|---|---|---|
| Coverage | Industry-wide top 10 signals | Industry highlights + all followed firms |
| Depth | Surface-level | Deep per-firm analysis |
| Personalization | None | Follows user's firm subscriptions |
| Purpose | Acquisition, brand awareness | Retention, decision support |
| Cadence | Weekly | Weekly |

### Upgrade Path Design

The free digest should explicitly reference the user's followed firms: "You follow FundedNext. This week, there were 4 significant signals for FundedNext. Upgrade to see them." This creates pull, not push, toward the paid tier.

### Launch Sequence

1. Launch paid digest first (or simultaneously) — it has a cleaner value prop and clear monetization
2. Use free digest as the downgrade/acquisition path, not the primary product
3. Do not make free so comprehensive that there is no reason to upgrade

---

## 5. Additional Design Decisions

### 5.1 Review Text vs. Star Rating — Sentiment Conflict

It is common on Trustpilot for a user to leave a 5-star rating with negative comment text (gaming the system, sarcasm, or misuse). **The AI classification must read the review text, not the star rating, for sentiment classification.**

This means:
- A 5-star review with text "they stole my money and blocked my account" should be classified as NEGATIVE / REPUTATION
- A 1-star review with text "I was confused at first but support resolved it quickly" should be classified as NEUTRAL or OPERATIONAL
- The `ai_summary`, `category`, and `severity` fields on `firm_trustpilot_reviews` must be derived from text analysis, not from the `rating` integer
- The `rating` integer is only used for the numerical score trend (Trustpilot Score Momentum feature) — not for intelligence signal classification

This is a classification pipeline concern, not a display concern. Needs to be enforced in `lib/ai/` classification logic.

### 5.2 Signal Volume on the Intelligence Feed Page

Do not show all signals. Show the most important and most discussed — target **5 to 8 cards** per feed view. Filtering logic should combine:
- Signal severity (REPUTATION > OPERATIONAL > INFORMATIONAL)
- Discussion volume (how many source reviews/tweets were grouped into this topic)
- Recency (prefer last 7 days over older signals)

Technical details for ranking/filtering are under investigation with tech-lead.

### 5.3 References per Topic Card

Currently 3 references per card. Target: **4 to 6**, depending on available source volume. The right number depends on how many source reviews or tweets are typically grouped into a single topic — tech-lead is assessing this.

### 5.4 Trustpilot Weekly Score — Long-term Storage

Weekly average scores must be stored with **longer retention than the 30-day rolling window** applied to raw reviews. The `firm_weekly_reports` table appears to already store weekly `avgRating` permanently — confirm and ensure this is not subject to the 30-day deletion. Weekly score history is what powers the score momentum sparkline and auto-signal generation.

Auto-signal trigger: when weekly score deviates more than 0.5 from the overall lifetime score for 2+ consecutive weeks → generate an intelligence signal automatically, no manual review required.

### 5.5 X Topics — Volume Threshold

Show **3 to 5 grouped topics maximum** per feed view, ordered by discussion volume. Topics with only 1 or 2 source tweets should not be surfaced — they are not a pattern. Exact minimum threshold to be tuned after initial data, but start at **minimum 5 posts across at least 3 distinct accounts** before a topic is surfaced.

### 5.6 Low-Activity Firms in Paid Digest

If a followed firm has no signals for the week (no Trustpilot reviews, no social activity, no payout anomalies), **skip that firm in the digest** — do not show a "no content this week" placeholder. The digest should only surface meaningful content.

---

## 6. Summary of Decisions

| Question | Decision |
|---|---|
| Show only incidents or all signals? | Show all signal types — positive, negative, neutral — tagged by classification |
| Sentiment from rating or text? | Text always wins — AI classifies from review content, not star count |
| X tweets: individual or topics? | Grouped topics, 3–5 max, minimum 5 posts / 3 accounts to surface |
| Card volume on feed page? | 5–8 cards max, filtered by severity + volume + recency |
| References per topic card? | 4–6 (tech-lead assessing feasibility) |
| Trustpilot weekly breakdown: build now? | Yes — weekly avg already stored in firm_weekly_reports; gap is scraping overall score |
| Trustpilot score auto-signal? | Auto, no manual review — trigger at >0.5 deviation for 2+ consecutive weeks |
| Weekly score retention? | Stored long-term (not subject to 30-day raw review deletion) |
| Weekly digest: free or paid first? | Free version first. Paid version planned but not built yet. |
| Free digest scope? | Industry-wide, top signals only — short, high-signal, no personalization |
| Paid digest scope? | Industry highlights + deep per-firm section for each followed firm |
| Minimum followed firms for paid? | 1 firm is enough — show industry highlights + that 1 firm's full section |
| Low-activity firms in paid digest? | Skip — no content = no value, don't show empty sections |

---

## 7. Technical Resolutions (from Tech-Lead)

### 7.1 Signal Ranking — Implementation

Currently the feed sorts by recency only. No composite ranking exists. A scoring formula can be applied before returning from the incidents API:

```
score = severity_weight + review_count + recency_boost
severity_weight: high=3, medium=2, low=1
recency_boost: +1 if within last 7 days
```

Changes needed (no schema changes):
- `app/api/v2/propfirms/[id]/incidents/route.js` — add composite sort + `?limit=N` param support
- `app/propfirms/[id]/intelligence/page.js` — pass `?days=30&limit=8` to the fetch

### 7.2 References Per Topic Card

The 3-reference limit is hardcoded in three places (no DB constraint — `review_ids` is an unbounded INT[] array):
- `app/api/v2/propfirms/[id]/incidents/route.js` line 126: `.slice(0, 3)`
- `components/propfirms/intelligence/IntelligenceCard.js` line 78: `.slice(0, 3)`
- `app/propfirms/[id]/intelligence/page.js` line 72: `.slice(0, 3)`

Change all three to `.slice(0, 6)`. Most spike-category incidents have 3–10+ source reviews, so 6 is viable for most. Lower-volume firms will naturally show fewer. No migration needed.

### 7.3 Weekly Score Retention — Bug Found

**There is a bug:** `firm_weekly_reports` rows are being deleted after 30 days. The deletion is in `scripts/backfill-firm-trustpilot-reviews.ts` line 37 via a hardcoded `REPORTS_RETENTION_DAYS = 30` constant (lines 71–79 execute the delete). This is the same retention as raw reviews — but weekly scores must be kept long-term.

Fix: change `REPORTS_RETENTION_DAYS` to 730 (2 years) or remove the `firm_weekly_reports` deletion block entirely. This is a one-line fix with significant impact — without it, the score momentum feature has no historical data to display.

### 7.4 Weekly Score Computation Accuracy

The daily scraper fetches the most recent 50 reviews at scrape time (env var `TRUSTPILOT_MAX_REVIEWS`, default 50). For high-volume firms receiving 30–50 reviews/day, some reviews could be missed between scrape runs. The unique URL deduplication prevents double-counting, but gaps are possible.

For the weekly average computation: the existing `generateWeeklyReport()` in `lib/digest/generator.ts` already queries `firm_trustpilot_reviews` filtered by `review_date` for the week range — this is the correct approach and already implemented. No new computation logic needed.

The weekly report cron runs Sundays only (GitHub Actions). For mid-week sparkline data, the current-week average can be computed on-the-fly from the reviews table in real-time (same query, narrowed to the current rolling 7 days). No separate cron needed for that.

### 7.5 Ticket Summary from Tech Investigation

| Ticket | File(s) | Complexity |
|---|---|---|
| Fix weekly reports deletion (30-day bug) | `scripts/backfill-firm-trustpilot-reviews.ts` L37, L71–79 | XS |
| Extend references from 3 to 6 | 3 files, `.slice(0,3)` → `.slice(0,6)` | XS |
| Add composite signal ranking + limit param | `incidents/route.js`, `intelligence/page.js` | S |
| Scrape Trustpilot overall score into firm_profiles | `lib/scrapers/trustpilot.ts`, new migration | M |
| Trustpilot trend API endpoint | `app/api/v2/propfirms/[id]/trustpilot-trend` (new route) | S |
| Score momentum sparkline — frontend | Intelligence sidebar component | M |
| Auto-signal: weekly score deviation trigger | Intelligence signal pipeline | M |
