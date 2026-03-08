# Sprint 10 — Verification Guide

This guide groups all 12 tickets into 5 verification batches. Each batch covers a related cluster of changes and can be verified in one sitting.

---

## Batch 1 — Database Schema & Retention
*Covers: S10-001, S10-006*

### What changed
| Before | After |
|--------|-------|
| `firm_weekly_reports` rows deleted after 30 days (same retention as raw reviews) | Weekly reports kept indefinitely (retention block removed) |
| `firm_profiles` had no Trustpilot aggregate score columns | 3 new columns: `trustpilot_overall_score`, `trustpilot_overall_review_count`, `trustpilot_overall_updated_at` |

### DB checks

**1a. Confirm weekly reports are not being deleted**
```sql
-- Count rows by age — should see rows older than 30 days if any exist
SELECT
  MIN(week_from_date) AS oldest_week,
  MAX(week_from_date) AS newest_week,
  COUNT(*) AS total_rows
FROM firm_weekly_reports;
```
Expected: `oldest_week` should be older than 30 days if data has been accumulating.

**1b. Confirm new columns exist on firm_profiles**
```sql
SELECT
  id,
  trustpilot_overall_score,
  trustpilot_overall_review_count,
  trustpilot_overall_updated_at
FROM firm_profiles
WHERE trustpilot_overall_score IS NOT NULL
LIMIT 10;
```
Expected: Rows with numeric scores (e.g. 4.2) and review counts for firms that have been scraped.

**1c. Confirm the old retention code is gone**
Check `scripts/backfill-firm-trustpilot-reviews.ts` — the block that deleted from `firm_weekly_reports` should no longer exist.

---

## Batch 2 — Intelligence Feed UI
*Covers: S10-002, S10-003, S10-005, S10-009*

### What changed
| Before | After |
|--------|-------|
| Each signal card showed max 3 source references | Max 6 references per card |
| Feed showed all signals sorted only by date | Feed shows top 8 signals ranked by severity + review count + recency |
| Only negative/incident signals appeared | POSITIVE (green) and INFORMATIONAL (grey) signals now appear |
| Sidebar showed static Trustpilot text | Sidebar shows live 8-week sparkline with delta vs overall score |

### UI checks — go to `/propfirms/fundednext/intelligence`

**2a. References per card (S10-002)**
- Find a card with many sources (e.g. a payout delay card for a busy firm)
- Count the source pill/link count — should now show up to 6 (previously capped at 3)
- Firms with fewer sources will naturally show fewer

**2b. Signal ranking (S10-003)**
- The top card should be a high-severity or high-review-count signal, not necessarily the most recent one
- A "payout_delay" with 15 reviews from 10 days ago should rank above a "pricing_fee_complaint" with 3 reviews from yesterday
- URL: `/propfirms/fundednext/intelligence` — verify order makes intuitive sense

**2c. Positive & neutral signals (S10-005)**
- Scroll through the feed — you should see at least one card with a **green dot** (POSITIVE) or **grey dot** (INFORMATIONAL)
- If using the type filter: select "Positive" — should show signals instead of empty state
- For a firm with recent positive payout reviews, a "Fast payouts praised by traders" style card should appear

**2d. Trustpilot sparkline in sidebar (S10-009)**
- Navigate to any firm intelligence page (e.g. `/propfirms/fundednext/intelligence`)
- Left sidebar should show a **"Trustpilot Trend"** section with:
  - A small line chart (8 weeks)
  - "This week: X.X" and "Overall: X.X" labels
  - A delta badge (e.g. "+0.2" in green, "-0.4" in red)
- If fewer than 2 weeks of data exist for a firm: shows "Trend data building..." text instead

**Before/after visual diff:**
- Before: Sidebar showed "Trustpilot" as a static text row with "Reliable customer support signals..."
- After: Between the signal rows and the "View full analytics" button, a new sparkline section with live data

---

## Batch 3 — Trustpilot Data Pipeline
*Covers: S10-007, S10-008*

### What changed
| Before | After |
|--------|-------|
| `firm_profiles` had no overall score data | Scraper now parses JSON-LD from Trustpilot page and stores aggregate score |
| No `/trustpilot-trend` endpoint existed | New API returns 8 weeks of weekly data + overall score |

### API check

**3a. Hit the trustpilot-trend endpoint**
```
GET /api/v2/propfirms/fundednext/trustpilot-trend
```
Expected response shape:
```json
{
  "overall_score": 4.2,
  "overall_review_count": 1840,
  "weeks": [
    {
      "week_from": "2026-03-02",
      "week_to": "2026-03-08",
      "avg_rating": 4.1,
      "review_count": 12,
      "rating_change": -0.1
    },
    ...
  ]
}
```
- `overall_score` should be a number (not null) for firms that have been scraped
- `weeks` should have up to 8 entries, ordered newest first
- If no data yet: `{ "overall_score": null, "overall_review_count": null, "weeks": [] }` (not a 404)

Try also: `fundingpips`, `ftmo` — at least 2 firms should have scores.

### DB check

**3b. Confirm scraper populated overall scores**
```sql
SELECT
  id,
  name,
  trustpilot_overall_score,
  trustpilot_overall_review_count,
  trustpilot_overall_updated_at
FROM firm_profiles
WHERE trustpilot_overall_score IS NOT NULL
ORDER BY trustpilot_overall_updated_at DESC
LIMIT 10;
```
Expected: Multiple firms with numeric scores. Cross-check one score against the actual Trustpilot page (e.g. FundedNext's Trustpilot page shows their rating).

---

## Batch 4 — AI Classification & Auto-Signals
*Covers: S10-004, S10-010*

### What changed
| Before | After |
|--------|-------|
| Classification might have used star rating as input signal | Classification uses only review text (title + body) — star rating not passed to AI |
| No automatic signal for consecutive Trustpilot score deviation | If weekly avg deviates >0.5 from overall for 2 consecutive weeks, a REPUTATION signal is auto-generated |

### DB checks

**4a. Confirm text-based classification (S10-004)**
```sql
-- Find reviews where star rating contradicts AI classification
-- e.g. 5-star reviews classified as negative
SELECT
  id,
  firm_id,
  rating,
  category,
  severity,
  LEFT(review_text, 100) AS preview
FROM firm_trustpilot_reviews
WHERE rating = 5
  AND category IN ('payout_delay', 'payout_denied', 'high_risk_allegation', 'support_issue')
LIMIT 10;
```
Expected: Some rows exist (5-star reviews with negative text should be correctly flagged as negative categories — this confirms text-based classification is working).

Before: These rows might not exist because the AI was using the star rating to determine category.

**4b. Confirm auto-signal exists (S10-010)**
```sql
-- Check for any trustpilot_score_trend incidents
SELECT
  firm_id,
  week_number,
  year,
  severity,
  title,
  summary,
  created_at
FROM firm_daily_incidents
WHERE incident_type = 'trustpilot_score_trend'
ORDER BY created_at DESC
LIMIT 10;
```
Expected if triggered: Rows with `title` like "Trustpilot Score Declining — 2nd Consecutive Week Below Average".

If no rows: the 2-consecutive-week threshold hasn't been met for any firm yet, or the daily script hasn't run since deployment. This is expected — run the incidents script manually to trigger:
```bash
npx tsx scripts/run-firm-daily-incidents.ts
```
Then re-check the query.

**4c. Confirm auto-signal appears in feed**
- If a `trustpilot_score_trend` row exists in DB, navigate to that firm's intelligence page
- Should appear as a **REPUTATION** (amber dot) card with the deviation-based title
- Filter by "Reputation" type — the card should be visible

---

## Batch 5 — X (Twitter) Pipeline
*Covers: S10-011, S10-012*

### What changed
| Before | After |
|--------|-------|
| One Apify run per firm per day (N+1 total runs) | Always exactly 2 Apify runs per day regardless of firm count |
| Run 1: per-firm keyword searches | Run 1: single combined `from:FirmA OR from:FirmB OR ...` query |
| Run 2: industry keywords (unchanged) | Run 2: industry keywords (unchanged) |
| Industry tweets stored only as `firm_id = 'industry'` | Industry tweets mentioning firms also get a row per mentioned firm (`source: 'industry_mention'`) |

### DB checks

**5a. Confirm firm_official tweets exist**
```sql
SELECT
  firm_id,
  source,
  COUNT(*) AS tweet_count,
  MAX(tweeted_at) AS latest
FROM firm_twitter_tweets
WHERE source = 'firm_official'
GROUP BY firm_id, source
ORDER BY latest DESC
LIMIT 10;
```
Expected: Rows with `source = 'firm_official'` for firm handles that have been scraped.

Before: Source value was `'firm'` — if you see `'firm'` rows they are old; new rows should be `'firm_official'`.

**5b. Confirm industry mention fan-out**
```sql
-- Find tweets that appear as both industry and firm rows (same URL)
SELECT
  url,
  COUNT(*) AS row_count,
  ARRAY_AGG(firm_id ORDER BY firm_id) AS firm_ids,
  ARRAY_AGG(source ORDER BY firm_id) AS sources
FROM firm_twitter_tweets
WHERE source IN ('industry', 'industry_mention')
GROUP BY url
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 10;
```
Expected: Rows where the same tweet URL appears once as `firm_id = 'industry'` and once (or more) as specific firm IDs with `source = 'industry_mention'`.

**5c. Check tweet count per run type**
```sql
SELECT
  source,
  COUNT(*) AS total,
  MAX(created_at) AS latest_ingested
FROM firm_twitter_tweets
GROUP BY source
ORDER BY total DESC;
```
Expected output:
| source | total | notes |
|--------|-------|-------|
| industry | N | unchanged |
| firm_official | N | new; replaces old 'firm' source |
| industry_mention | N | new; fan-out rows |
| firm | N (old) | legacy rows from before S10-011 |

---

## Quick Sanity URLs

| Check | URL |
|-------|-----|
| Intelligence feed (main verify) | `/propfirms/fundednext/intelligence` |
| Intelligence feed (different firm) | `/propfirms/fundingpips/intelligence` |
| Trustpilot trend API | `/api/v2/propfirms/fundednext/trustpilot-trend` |
| Trustpilot trend API (another firm) | `/api/v2/propfirms/fundingpips/trustpilot-trend` |
| Incidents API (with limit) | `/api/v2/propfirms/fundednext/incidents?days=30&limit=8` |

---

## Expected "Before vs After" Summary

| Area | Before S10 | After S10 |
|------|-----------|-----------|
| Weekly report history | Lost after 30 days | Permanent |
| References per signal card | Max 3 | Max 6 |
| Signal sort order | Date only | Severity × volume × recency |
| Signal types shown | Negative/incident only | + Positive (green) + Informational (grey) |
| Sidebar (intelligence page) | Static text rows | Live sparkline + delta |
| Trustpilot aggregate score | Not stored | Scraped from JSON-LD, stored in firm_profiles |
| Trustpilot trend API | 404 | Returns 8 weeks + overall score |
| AI classification input | May include star rating | Text only (title + review body) |
| Trustpilot deviation auto-signal | Never generated | Auto-fires after 2 consecutive weeks >0.5 deviation |
| Twitter runs/day | N+1 (per-firm + industry) | Always 2 (combined from: + industry) |
| Industry tweets attribution | industry row only | industry row + per-firm rows via fan-out |
