# TICKET-004: Daily Scraper Cron Job

**Status:** Done (via GitHub Actions)  
**Schedule:** Daily at 2 AM UTC

---

## Implementation

We use **GitHub Actions** instead of Vercel Cron because:

- The scraper uses **Playwright/Chromium** (not available on Vercel serverless).
- Run time is **~2–5 minutes** (3 firms × 3 pages × delays); Vercel cron free tier has a 10s limit.

**Workflow:** [.github/workflows/sync-trustpilot-reviews.yml](../.github/workflows/sync-trustpilot-reviews.yml)

- **Schedule:** `0 2 * * *` (2 AM UTC daily).
- **Manual run:** Actions → "Sync Trustpilot Reviews (Daily)" → "Run workflow".
- **Firms:** the5ers, fundingpips, fundednext (same as backfill script; 3 pages per firm).
- **Secrets required:** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (same as other workflows).

---

## Acceptance criteria (alpha_tickets.md)

- [x] Automated daily scraping (2 AM UTC) — GitHub Actions cron.
- [x] Runs scraper for active firms (the5ers, fundingpips, fundednext).
- [x] 3 pages per firm (scraper default).
- [ ] ~~Vercel cron + `app/api/cron/scrape-trustpilot/route.js`~~ — Not used (Playwright + timeout).
- [ ] ~~vercel.json crons~~ — Not used.
- [x] Manual trigger — `workflow_dispatch`.
- [ ] Monitor logs — GitHub Actions run logs.
- [ ] Failure alerts — Optional: add Slack/email in a later iteration.

---

## First-time setup

Ensure repo secrets exist:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

(Same as sync-trader-payouts and sync-firm-payouts workflows.)
