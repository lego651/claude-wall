# TICKET-003: Historical Data Backfill

**Status:** Done (first-page data acceptable)  
**Acceptance:** Run scraper for the5ers, fundingpips, fundednext → verify in Supabase; document issues.

---

## Pagination (3 pages per run)

The scraper loads **up to 3 pages** per firm (`maxPages: 3`). Trustpilot uses `?page=2`, `?page=3`. We get ~20–60 reviews per firm per run (~60–180 total for 3 firms). Duplicates across pages are deduped by `trustpilot_url`; total is capped by `maxReviews` (default 150).

---

## How to run

```bash
npx tsx scripts/backfill-trustpilot.ts
```

Requires `.env` with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Verification checklist (Supabase)

After running the backfill:

### 1. No duplicates

```sql
SELECT trustpilot_url, COUNT(*) AS cnt
FROM trustpilot_reviews
GROUP BY trustpilot_url
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows.

### 2. Count by firm (~50 per firm)

```sql
SELECT firm_id, COUNT(*) AS review_count
FROM trustpilot_reviews
GROUP BY firm_id
ORDER BY firm_id;
```

**Expected:** 3 rows (the5ers, fundingpips, fundednext), each with ~50 reviews.

### 3. Dates parsed correctly

```sql
SELECT firm_id, review_date, rating, title, LEFT(review_text, 60) AS text_preview
FROM trustpilot_reviews
ORDER BY review_date DESC
LIMIT 15;
```

**Expected:** `review_date` is valid date; rating 1–5; title/text non-empty where present.

### 4. All fields populated (spot check)

```sql
SELECT
  firm_id,
  rating,
  title IS NOT NULL AND title != '' AS has_title,
  review_text IS NOT NULL AND LENGTH(review_text) > 0 AS has_text,
  reviewer_name IS NOT NULL AS has_reviewer,
  review_date IS NOT NULL AS has_date,
  trustpilot_url IS NOT NULL AND trustpilot_url != '' AS has_url
FROM trustpilot_reviews
LIMIT 20;
```

**Expected:** `has_text`, `has_date`, `has_url` true for all; others may be null per Trustpilot.

---

## Scraping issues (document here)

| Date       | Firm        | Issue (blocked URL, missing data, timeout, etc.) | Resolution |
|------------|-------------|----------------------------------------------------|------------|
| _optional_ | _optional_  | _describe_                                         | _optional_ |

Leave table empty if no issues. Add rows when something fails or looks wrong.

---

## Acceptance criteria (TICKET-003)

- [ ] Run `scrapeTrustpilot()` for the5ers, fundingpips, fundednext
- [ ] Scrape ~150+ total reviews (50 per firm)
- [ ] Verify in Supabase: no duplicates, dates parsed correctly, fields populated
- [ ] Document any scraping issues above
