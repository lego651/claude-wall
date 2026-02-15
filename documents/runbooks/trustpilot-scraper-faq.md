# Trustpilot Scraper – FAQ

## 1. What stores the expiry date for each review? Do we only keep last 30 days?

**There is no per-row “expiry date” column.** Retention is enforced by **deleting old rows** at the end of the same run that does the scrape.

- **Where:** The daily scrape workflow (`.github/workflows/step1-sync-trustpilot-reviews-daily.yml`) runs `scripts/backfill-firm-trustpilot-reviews.ts`. That script (1) scrapes all firms, (2) then runs **retention cleanup** in the same process:
  - **trustpilot_reviews** where `review_date` &lt; today − 30 days (env `TRUSTPILOT_REVIEWS_RETENTION_DAYS`, default 30).
  - **weekly_incidents** where `created_at` &lt; now − 30 days.
  - **weekly_reports** where `generated_at` &lt; now − 30 days.
- So we do **not** keep all reviews forever; we only keep the last 30 days (or whatever you set via env). No separate cleanup workflow.

---

## 2. How many pages do we scrape per firm? Why that number?

- **Default:** **3 pages** per firm.
- **Cap:** **50 reviews** per firm per run (env: `TRUSTPILOT_MAX_REVIEWS`).
- **Env override:** `TRUSTPILOT_BACKFILL_PAGES` (e.g. `1` for a quick test).

**Why 3 pages?**

- ~20 reviews per page → 3 pages ≈ 60 reviews; with `maxReviews: 50` we typically get 50 reviews per firm.
- 8 firms × ~50 reviews ≈ 400 reviews/day, which is enough for daily incident detection and keeps the run within the GitHub Actions **15-minute** timeout.
- More pages = longer run and higher chance of rate limiting or timeouts.

So: **3 pages** is a balance between freshness, volume, and job duration.

---

## 3. If we scrape 10 pages a day, wouldn’t there be duplicates? Are they excluded?

**Yes. Duplicates are excluded.**

- Each review is identified by its **Trustpilot URL**.
- The table has a **UNIQUE constraint** on `trustpilot_url` (see `migrations/11_alpha-intelligence-schema.sql`).
- On insert, if that URL already exists, Postgres returns error code `23505` (unique violation).
- The scraper treats `23505` as “duplicate” and **skips** the insert, and counts it as `duplicatesSkipped`.

So if you run 10 pages today and again tomorrow, the second run will re-scrape the same URLs; inserts for already-stored URLs will be skipped. You’ll see “stored 0, skipped N duplicates” for the overlapping set.

---

## 4. Where are the Trustpilot company links? Can I see or edit them?

**Single source of truth:** **Supabase `firms` table, column `trustpilot_url`.**

- The scraper and backfill read from `firms` where `trustpilot_url IS NOT NULL`. No hardcoded list in code.
- **To see:** In Supabase, open Table Editor → `firms` → check `trustpilot_url`.
- **To edit:** Update `firms.trustpilot_url` in Supabase (or run `UPDATE firms SET trustpilot_url = '...' WHERE id = '...';`). Add a new firm with a non-null `trustpilot_url` to include it in the next scrape.
- **Initial seed:** Migration `migrations/18_seed-firms-trustpilot-urls.sql` sets `trustpilot_url` for the 8 prop firms. Run it once if the column is empty.
- **Code:** `lib/scrapers/trustpilot.ts` exports `getFirmsWithTrustpilot()` to fetch the list from the DB; the backfill calls it at the start of each run.
