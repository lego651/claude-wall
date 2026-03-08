# Sprint 10 Tickets — Intelligence Feed Quality + Trustpilot Momentum + X Pipeline Refactor

**Sprint Goal:**
1. **Intelligence feed quality** — composite signal ranking, positive signal coverage, more references per card
2. **Trustpilot Score Momentum** — weekly vs. overall score trend, sparkline, auto-signal generation
3. **X pipeline cost refactor** — hybrid 2-run model replacing per-firm keyword searches

**Context:** [intelligence-feed-strategy.md](./intelligence-feed-strategy.md)
**Previous sprint:** [s9_tickets.md](./s9_tickets.md)

**Story points:** 1, 2, 3, 5

**Deferred to S11:** X topic display on intelligence feed, free newsletter template & delivery.

---

## Epic 1: Quick Wins & Bug Fixes

### TICKET-S10-001: Fix firm_weekly_reports 30-Day Deletion Bug

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 1

**Description:** `firm_weekly_reports` rows are being deleted after 30 days by the same retention policy as raw reviews. This destroys the historical weekly avg rating data needed for the Trustpilot Score Momentum feature and the digest pipeline. Must be fixed before the momentum feature is built.

**Acceptance criteria:**

- [ ] In `scripts/backfill-firm-trustpilot-reviews.ts`, change `REPORTS_RETENTION_DAYS` constant (line 37) from `30` to `730`
- [ ] Alternatively, remove the `firm_weekly_reports` deletion block entirely (lines 71–79) — preferred if there is no reason to ever delete weekly reports
- [ ] Confirm existing `firm_weekly_reports` rows are not affected by this change (they should not be — change only affects future cleanup runs)
- [ ] Run the script manually to verify no unexpected deletion occurs

**Files:** `scripts/backfill-firm-trustpilot-reviews.ts` L37, L71–79

---

### TICKET-S10-002: Extend Topic Card References from 3 to 6

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 1

**Description:** The intelligence feed currently shows 3 source references per grouped topic card. The limit is hardcoded in 3 places. Extend to 6 to show more evidence per signal. Lower-volume firms will naturally show fewer when fewer sources exist.

**Acceptance criteria:**

- [ ] `app/api/v2/propfirms/[id]/incidents/route.js` line 126: `.slice(0, 3)` → `.slice(0, 6)`
- [ ] `components/propfirms/intelligence/IntelligenceCard.js` line 78: `.slice(0, 3)` → `.slice(0, 6)`
- [ ] `app/propfirms/[id]/intelligence/page.js` line 72: `.slice(0, 3)` → `.slice(0, 6)`
- [ ] Visually verify on `/propfirms/fundednext/intelligence` that cards with many sources now show up to 6 references without layout breakage

**Files:** 3 files above (`.slice` changes only)

---

### TICKET-S10-003: Composite Signal Ranking + Feed Limit

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 2

**Description:** The intelligence feed currently sorts only by recency and shows all signals. Add a composite ranking score and a `?limit` param so the feed surfaces the 5–8 most important signals rather than everything.

**Ranking formula:**
```
score = severity_weight + review_count + recency_boost
severity_weight: high=3, medium=2, low=1
recency_boost: +1 if evidence_date within last 7 days
```

**Acceptance criteria:**

- [ ] `app/api/v2/propfirms/[id]/incidents/route.js` — after existing `evidence_date` sort, apply composite ranking sort; add `?limit` query param support (default: no limit for backwards compat)
- [ ] `app/propfirms/[id]/intelligence/page.js` — pass `?days=30&limit=8` to the incidents fetch
- [ ] Top cards on the feed should reflect severity + volume, not just recency — verify that a high-severity, high-review-count signal from 2 weeks ago ranks above a low-severity signal from yesterday
- [ ] Existing filter (All Types / OPERATIONAL / REPUTATION) still works correctly after ranking change

**Files:** `app/api/v2/propfirms/[id]/incidents/route.js`, `app/propfirms/[id]/intelligence/page.js`

---

## Epic 2: Intelligence Feed — Signal Coverage

### TICKET-S10-004: Enforce Text-Based Sentiment Classification (Not Star Rating)

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 2

**Description:** The AI classification for Trustpilot reviews must derive `category`, `severity`, and `ai_summary` from review text, not from the `rating` integer. A 5-star review with negative text should classify as NEGATIVE. The `rating` integer is only used for numerical score calculations.

**Acceptance criteria:**

- [ ] Review the AI classification prompt/logic in `lib/ai/` (classifier used for `firm_trustpilot_reviews`)
- [ ] Confirm the prompt does not use `rating` as an input signal for category or severity
- [ ] If it does, remove `rating` from the classification input — pass only `title`, `review_text`, and `reviewer_name`
- [ ] Add a test case: a mock review with `rating: 5` and text expressing a negative experience should return `category: REPUTATION` or `category: NEGATIVE`, not POSITIVE
- [ ] Verify existing classified reviews are not silently relying on star rating (spot-check a sample in DB)

**Files:** `lib/ai/` (classification prompt/logic for reviews)

---

### TICKET-S10-005: Surface Positive & Neutral Signals in Intelligence Feed

**Status:** ✅ Done
**Priority:** P1
**Story points:** 2

**Description:** The intelligence feed currently shows mostly negative/incident signals because the classification and display pipeline does not actively promote positive signals. This creates a bias toward negatives that contradicts our "unbiased evaluation" product promise.

**Acceptance criteria:**

- [ ] Audit `lib/ai/` and `app/api/v2/propfirms/[id]/incidents/route.js` — verify whether POSITIVE and NEUTRAL categories are stored and returned or filtered out
- [ ] If filtered: remove the filter or adjust it to include POSITIVE and INFORMATIONAL signal types
- [ ] If not classified: add POSITIVE and INFORMATIONAL as valid categories to the classification taxonomy and prompt
- [ ] Signal type labels and colors per strategy doc:
  - POSITIVE (green dot): fast payouts, improved support, rule improvements
  - INFORMATIONAL / NEUTRAL (grey dot): announcements, promotions, policy updates
  - REPUTATION (amber dot): mixed sentiment, community debates
  - NEGATIVE / INCIDENT (red dot): existing behavior
- [ ] Verify on `/propfirms/fundednext/intelligence` that at least one POSITIVE or INFORMATIONAL signal appears for a firm with positive payout data

**Files:** `lib/ai/` (classification taxonomy), `app/api/v2/propfirms/[id]/incidents/route.js`, possibly `components/propfirms/intelligence/IntelligenceCard.js` (color mapping)

---

## Epic 3: Trustpilot Score Momentum

### TICKET-S10-006: Migration — Add trustpilot_overall_score to firm_profiles

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 1

**Description:** Add columns to store the official Trustpilot lifetime aggregate score per firm, scraped from the Trustpilot page. This is the "baseline" score the weekly trend is compared against.

**Acceptance criteria:**

- [ ] New migration `migrations/32_add_firm_trustpilot_overall_score.sql`
- [ ] Add to `firm_profiles`:
  - `trustpilot_overall_score NUMERIC(3,1)` — e.g. 4.2
  - `trustpilot_overall_review_count INT` — total review count from Trustpilot
  - `trustpilot_overall_updated_at TIMESTAMPTZ` — when these were last scraped
- [ ] Columns are nullable (not all firms have Trustpilot)
- [ ] No RLS changes needed (admin-managed data)

**Files:** `migrations/32_add_firm_trustpilot_overall_score.sql`

---

### TICKET-S10-007: Scraper — Parse Trustpilot Aggregate Score from JSON-LD

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 2

**Description:** Trustpilot's listing page contains a `<script type="application/ld+json">` block with `aggregateRating.ratingValue` and `aggregateRating.reviewCount`. Extend the daily scraper to parse and store these values into `firm_profiles`.

**Acceptance criteria:**

- [ ] In `lib/scrapers/trustpilot.ts`, after loading the firm's Trustpilot page, parse the JSON-LD structured data block and extract `aggregateRating.ratingValue` and `aggregateRating.reviewCount`
- [ ] In `scripts/backfill-firm-trustpilot-reviews.ts`, after each firm scrape, write these values to `firm_profiles.trustpilot_overall_score`, `trustpilot_overall_review_count`, and `trustpilot_overall_updated_at`
- [ ] Handle missing/null gracefully (firms without a Trustpilot page should not error)
- [ ] Log the scraped overall score per firm in the script output for observability
- [ ] Manually verify the scraped value matches what Trustpilot displays for at least 2 firms (FundedNext, FundingPips)

**Files:** `lib/scrapers/trustpilot.ts`, `scripts/backfill-firm-trustpilot-reviews.ts`

**Dependencies:** S10-006

---

### TICKET-S10-008: Backend — /api/v2/propfirms/[id]/trustpilot-trend Endpoint

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 2

**Description:** New API route returning the last 8 weeks of weekly average Trustpilot ratings for a firm, plus the current overall score. Powers the score momentum sparkline on the intelligence sidebar.

**Acceptance criteria:**

- [ ] New route: `GET /api/v2/propfirms/[id]/trustpilot-trend`
- [ ] Response shape:
  ```json
  {
    "overall_score": 4.2,
    "overall_review_count": 1840,
    "weeks": [
      { "week_from": "2026-01-20", "week_to": "2026-01-26", "avg_rating": 4.1, "review_count": 12, "rating_change": -0.1 },
      ...
    ]
  }
  ```
- [ ] `weeks` array: query `firm_weekly_reports` ordered by `week_from_date DESC`, last 8 rows, extract `trustpilot.avgRating`, `trustpilot.reviewCount`, `trustpilot.ratingChange` from `report_json`
- [ ] `overall_score` + `overall_review_count`: read from `firm_profiles.trustpilot_overall_score` / `trustpilot_overall_review_count`
- [ ] Return `{ overall_score: null, weeks: [] }` if no data (do not 404)
- [ ] Public route (no auth required)

**Files:** `app/api/v2/propfirms/[id]/trustpilot-trend/route.js` (new file)

**Dependencies:** S10-006, S10-007, S10-001 (to ensure weekly report history exists)

---

### TICKET-S10-009: Frontend — Score Momentum Sparkline in Intelligence Sidebar

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 3

**Description:** Add an 8-week Trustpilot score trend sparkline to the intelligence page sidebar, showing weekly avg rating over time and the delta vs. the overall lifetime score. This is a key visual signal for traders.

**Acceptance criteria:**

- [ ] Fetch from `/api/v2/propfirms/[id]/trustpilot-trend` in the intelligence sidebar component
- [ ] Display: small sparkline chart (8 weeks), current week avg rating, overall score, and delta (e.g. "This week: 3.8 vs. overall: 4.2 ↓")
- [ ] Color the delta: green if weekly > overall, red if weekly < overall by >0.3, grey if within 0.3
- [ ] If fewer than 2 weeks of data: show "Trend data building..." placeholder instead of sparkline
- [ ] Fits within existing sidebar layout without redesign (use compact size)
- [ ] No layout breakage on mobile

**Files:** Intelligence sidebar component (existing), possibly a new `TrustpilotSparkline` component

**Dependencies:** S10-008

---

### TICKET-S10-010: Auto-Signal — Generate Intelligence Signal on Score Deviation

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 3

**Description:** When a firm's weekly Trustpilot score deviates more than 0.5 from its overall score for 2+ consecutive weeks, automatically generate an intelligence signal in the feed. No manual review required.

**Acceptance criteria:**

- [ ] Add a check in the weekly report generation pipeline (`scripts/generate-firm-weekly-reports.ts` or `lib/digest/generator.ts`): after computing weekly `avgRating`, compare to `firm_profiles.trustpilot_overall_score`
- [ ] If `|avgRating - overall_score| > 0.5` for the current week AND the prior week (check `firm_weekly_reports` for previous week), insert a signal into `firm_daily_incidents` (or equivalent intelligence signal table):
  - `category`: REPUTATION
  - `severity`: high (if declining), medium (if improving)
  - `title`: e.g. "Trustpilot Score Declining — 2nd Consecutive Week Below Average"
  - `ai_summary`: e.g. "Weekly Trustpilot avg (3.8) has been below overall score (4.3) for 2 consecutive weeks. This may indicate emerging operational issues."
- [ ] Do not create duplicate signals — check if a signal for this firm + this week already exists before inserting
- [ ] Signal should appear in the intelligence feed on the next page load
- [ ] Applies to both declining (red) and improving (green) trends

**Files:** `scripts/generate-firm-weekly-reports.ts` or `lib/digest/generator.ts`, intelligence signal insert logic

**Dependencies:** S10-006, S10-007, S10-008

---

## Epic 4: X Pipeline — Hybrid 2-Run Model

### TICKET-S10-011: Refactor Twitter Fetch to Hybrid 2-Run Model

**Status:** ✅ Done
**Priority:** P0
**Story points:** 3

**Description:** Replace per-firm Apify keyword searches with a fixed 2-run model: one combined `from:` query across all firm official accounts, plus one industry keyword run. Reduces Apify cost from N+1 runs/day to always 2 runs/day regardless of firm count.

**Acceptance criteria:**

- [ ] `config/twitter-monitoring.ts` — replace per-firm `searchTerms` arrays with a `firmHandles` list (e.g. `{ firmId: 'fundednext', handle: 'FundedNext' }`). Build the combined `from:FundedNext OR from:FundingPips OR ...` query string at runtime
- [ ] `lib/twitter-fetch/fetch-job.ts` — remove the per-firm Apify run loop. Replace with:
  1. Run 1: single Apify call with the combined `from:` union query, tag results as `source: 'firm_official'`
  2. Run 2: existing industry keyword run (unchanged)
- [ ] Firm attribution for Run 1: after fetch, for each tweet, match `tweet.author_handle` against `firmHandles` list to set `firmId`
- [ ] Existing industry run (Run 2) behavior unchanged — `mentioned_firm_ids` attribution handled in S10-012
- [ ] Verify: after refactor, 3 firms → 2 Apify runs (not 4)
- [ ] Keep `source: 'firm_official'` distinct from old `source: 'firm'` for observability — or map to same value if schema requires it

**Files:** `config/twitter-monitoring.ts`, `lib/twitter-fetch/fetch-job.ts`

---

### TICKET-S10-012: Fan Out Industry Tweets to Firm Rows via mentioned_firm_ids

**Status:** ✅ Done
**Priority:** P1
**Story points:** 3

**Description:** The AI already extracts `mentioned_firm_ids` for industry tweets. Currently these tweets are stored only as industry-level rows. Fan them out: for each mentioned firm, insert an additional `firm_twitter_tweets` row attributed to that firm so it appears in the firm's intelligence feed.

**Acceptance criteria:**

- [ ] In `lib/twitter-ingest/ingest.ts`, after AI categorization of industry tweets: for each tweet where `mentioned_firm_ids` is non-empty, insert one `firm_twitter_tweets` row per mentioned firm (in addition to the industry row)
- [ ] Set `firm_id` to the mentioned firm's ID, `source: 'industry_mention'`
- [ ] Deduplication: the existing `UNIQUE (firm_id, url)` constraint handles duplicates — use upsert (insert on conflict do nothing)
- [ ] A tweet mentioning 2 firms produces 2 firm rows + 1 industry row (3 total) — verify this is correct behavior
- [ ] Verify in DB after a test run: a tweet mentioning "FundedNext" appears in both `firm_id = 'fundednext'` and `firm_id = 'industry'` rows

**Files:** `lib/twitter-ingest/ingest.ts`

**Dependencies:** S10-011

---

## Implementation Order

```
Week 1 (unblock + foundation):
  Day 1:   S10-001 (bug fix - weekly reports)   ← do first, prevents data loss
  Day 1:   S10-002 (references 3→6)             ← same session, trivial
  Day 1-2: S10-006 (migration - overall score)  ← unblocks all of Epic 3
  Day 2-3: S10-003 (signal ranking)             ← independent, parallelizable
  Day 2-3: S10-004 (text-based classification)  ← independent

Week 2 (core features):
  Day 4:   S10-007 (scraper - overall score)    ← needs S10-006
  Day 4-5: S10-005 (positive signals)           ← independent
  Day 5:   S10-008 (trustpilot-trend API)       ← needs S10-006, S10-007
  Day 5-6: S10-011 (X pipeline refactor)        ← independent epic, parallel

Week 3 (frontend + auto-signals):
  Day 7-8: S10-009 (sparkline frontend)         ← needs S10-008
  Day 8-9: S10-012 (fan out mentions)           ← needs S10-011
  Day 9-10: S10-010 (auto-signal on deviation)  ← needs S10-008, validated data
```

---

## Summary

| Ticket   | Title                                          | Points | Priority | Epic |
|----------|------------------------------------------------|--------|----------|------|
| S10-001  | Fix firm_weekly_reports 30-day deletion bug    | 1      | P0       | 1    |
| S10-002  | Extend topic card references from 3 to 6       | 1      | P0       | 1    |
| S10-003  | Composite signal ranking + feed limit          | 2      | P0       | 1    |
| S10-004  | Text-based sentiment classification            | 2      | P0       | 2    |
| S10-005  | Surface positive & neutral signals in feed     | 2      | P1       | 2    |
| S10-006  | Migration — trustpilot_overall_score columns   | 1      | P0       | 3    |
| S10-007  | Scraper — parse Trustpilot JSON-LD score       | 2      | P0       | 3    |
| S10-008  | Backend — trustpilot-trend API endpoint        | 2      | P0       | 3    |
| S10-009  | Frontend — score momentum sparkline            | 3      | P1       | 3    |
| S10-010  | Auto-signal — score deviation trigger          | 3      | P1       | 3    |
| S10-011  | X pipeline refactor — hybrid 2-run model       | 3      | P0       | 4    |
| S10-012  | Fan out industry tweets to firm rows           | 3      | P1       | 4    |

**Total: 25 points**
**P0: 12 points** (bug fixes, classification fixes, Trustpilot data pipeline, X refactor)
**P1: 13 points** (positive signals, sparkline, auto-signal, tweet fan-out)

---

## Deferred to S11

- X topic grouping backend (cluster firm tweets into discussion topics)
- X topic cards displayed on intelligence feed page
- Free newsletter — template, content generation, send pipeline
- Paid newsletter — per-firm deep-dive template (design only in S11, build in S12)
