# Intelligence data retention

**Note:** Retention cleanup now runs inside the scrape job (`scripts/backfill-trustpilot.ts`), not as a separate workflow. See `documents/runbooks/trustpilot-scraper-faq.md`.

## 1. Trustpilot sync: 3 pages max, 50 reviews max

- **Daily cron** ([.github/workflows/sync-trustpilot-reviews.yml](../.github/workflows/sync-trustpilot-reviews.yml)) runs with `TRUSTPILOT_BACKFILL_PAGES=3` and `TRUSTPILOT_MAX_REVIEWS=50`. So we scrape at most 3 pages per firm and stop once we have 50 reviews (whichever is hit first).
- **Manual backfill** (e.g. `npx tsx scripts/backfill-trustpilot.ts`) uses default 6 pages and no review cap unless you set `TRUSTPILOT_BACKFILL_PAGES` and/or `TRUSTPILOT_MAX_REVIEWS` in the environment.

## 2. Clean old data (daily)

A **daily** cron ([.github/workflows/clean-old-intelligence-data.yml](../.github/workflows/clean-old-intelligence-data.yml)) runs [scripts/clean-old-intelligence-data.ts](../scripts/clean-old-intelligence-data.ts) at 2 AM UTC. It deletes:

| Table | Keep | Delete |
|-------|------|--------|
| **trustpilot_reviews** | Last 7 days (by `review_date`) | Rows where `review_date` &lt; (today − 7 days) |
| **weekly_incidents** | Last 30 days (by `created_at`) | Rows where `created_at` &lt; (now − 30 days) |
| **weekly_reports** | Last 30 days (by `generated_at`) | Rows where `generated_at` &lt; (now − 30 days) |

**Manual run:**
```bash
npx tsx scripts/clean-old-intelligence-data.ts
```

Requires: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Rationale

- **trustpilot_reviews (7 days):** We only need recent reviews for incident detection (7d window) and signals (30d). Keeping 7 days keeps the table small and avoids storing long-term history.
- **weekly_incidents / weekly_reports (30 days):** APIs and UI use “last 30 days” or “last 90 days” of incidents/reports; 30 days of retention is enough for that and keeps storage bounded.
