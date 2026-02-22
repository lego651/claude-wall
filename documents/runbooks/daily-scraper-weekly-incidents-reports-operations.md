# Daily Scraper + Weekly Incidents & Reports — Operations

How to run and debug the **daily Trustpilot scraper**, **weekly incidents** (incident detection), and **weekly email reports**: manual triggers, debugging failures, email delivery logs, and adding new firms.

**See also:** [Intelligence Feed System Architecture](./intelligence-feed-system-architecture.md) for pipeline overview and data flow. **Twitter/X monitoring** (fetch + ingest, cron, config): [Twitter monitoring runbook](./twitter-monitoring.md). **To test Step 4 (digest) end-to-end:** [Test Step 4 – Weekly Digest](./test-step4-weekly-digest.md).

---

## Manually trigger workflows

All intelligence workflows support **workflow_dispatch** (manual trigger) in GitHub Actions.

1. Open the repo on GitHub → **Actions**.
2. Select the workflow in the left sidebar:
   - **Step 1 – Sync Trustpilot Reviews (Daily)** — `daily-step1-sync-firm-trustpilot-reviews.yml`
   - **Step 2 – Sync Classify Reviews (Daily)** — `daily-step2-sync-firm-classify-reviews.yml`
   - **Step 3 – Sync Incidents (Daily)** — `daily-step3-sync-firm-incidents.yml`
   - **Weekly Step 1 – Generate Firm Weekly Reports** — `weekly-step1-generate-firm-weekly-reports.yml`
   - **Weekly Step 2 – Send Firm Weekly Reports** — `weekly-step2-send-firm-weekly-reports.yml`
3. Click **Run workflow** → choose branch (e.g. `main`) → **Run workflow**.

**Requirements:**

- **Scraper / Classify / Incidents:** GitHub repo must have secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (for classify and incidents). Scraper also needs Playwright (workflow installs Chromium).
- **Send Weekly Reports (Weekly Step 2):** Vercel must have `CRON_SECRET`; call is `GET /api/cron/send-weekly-reports` with `Authorization: Bearer <CRON_SECRET>`. You can trigger the workflow (weekly-step2-send-firm-weekly-reports.yml; it runs the same API via `curl` and `SITE_URL` + secret) or call the API yourself.

---

## Debug scraper failures

1. **GitHub Actions logs**  
   Actions → **Sync Trustpilot Reviews (Daily)** → latest run → open the job → expand "Run Trustpilot scraper…". Look for errors (e.g. timeout, selector not found, network).

2. **Database: last scraper status per firm**  
   Table `firms` has: `last_scraper_run_at`, `last_scraper_reviews_scraped`, `last_scraper_reviews_stored`, `last_scraper_duplicates_skipped`, `last_scraper_error`.  
   - If `last_scraper_error` is set for a firm, the last run for that firm failed; the message is stored there.  
   - Query in Supabase SQL Editor:
     ```sql
     SELECT id, name, last_scraper_run_at, last_scraper_error
     FROM firms
     WHERE trustpilot_url IS NOT NULL;
     ```

3. **Admin dashboard**  
   `/admin/dashboard` → **Trustpilot scraper** section shows each firm's last run time, counts, and error (if any). Use this for a quick glance.

4. **Run scraper locally (optional)**  
   From repo root, with `.env` set (Supabase + optional scraper env):
   ```bash
   npx tsx scripts/backfill-firm-trustpilot-reviews.ts
   ```
   Or use the script that the workflow runs (see workflow `run` step). Local runs use the same `lib/scrapers/trustpilot.ts` and update `firms` and `trustpilot_reviews`.

5. **Common causes**  
   - Trustpilot blocking or rate limit: increase delay, reduce pages.  
   - Wrong or dead Trustpilot URL: fix `firms.trustpilot_url` for that firm.  
   - Timeout: reduce `maxPages` / `maxReviews` or re-run for a single firm.

---

## Check email delivery logs

1. **Resend dashboard**  
   Log in to [Resend](https://resend.com) → **Logs** (or **Emails**). Filter by recipient or time to see sends from the app (weekly digest and any alerts).

2. **Weekly reports API**  
   - Trigger **Send Weekly Reports** workflow and check its logs for the `curl` response (e.g. `{ "sent": N, "failed": M }`).  
   - Or call the API directly (GET) and inspect response:
     ```bash
     curl -s -H "Authorization: Bearer $CRON_SECRET" "https://<your-app>/api/cron/send-weekly-reports"
     ```

3. **Admin dashboard**  
   **Intelligence feed** section shows last week's report coverage (e.g. firms with report / firms expected). No per-email log here; use Resend for delivery details.

4. **Alerts**  
   Pipeline alerts (scraper stale, classifier backlog) go to `ALERT_EMAIL` / `ALERTS_TO` and are throttled (4h per condition). Check Resend logs for those addresses if you expect an alert and didn't get one.

---

## Add new firms to the scraper

The scraper only runs for firms that have a non-null **Trustpilot URL** in the database.

1. **Ensure the firm exists in `firms`**  
   If the firm is not yet in the directory, add it (via your normal firms data / migrations). You need a row in `firms` with a unique `id`.

2. **Set Trustpilot URL**  
   In Supabase SQL Editor (or via an admin/migration):
   ```sql
   -- If the firm already exists (e.g. id = 'newfirm'):
   UPDATE firms
   SET trustpilot_url = 'https://www.trustpilot.com/review/newfirm.com'
   WHERE id = 'newfirm';

   -- If you're adding a new firm (adjust columns to match your schema):
   INSERT INTO firms (id, name, trustpilot_url, ...)
   VALUES ('newfirm', 'NewFirm', 'https://www.trustpilot.com/review/newfirm.com', ...);
   ```

3. **Verify**  
   - Confirm the URL works in a browser (Trustpilot review page for that domain).  
   - On the next scraper run (or a manual run), the new firm will be included. No code change is required; the scraper reads `firms` where `trustpilot_url IS NOT NULL` (see `lib/scrapers/trustpilot.ts` / `getFirmsWithTrustpilot()`).

4. **Optional: seed via migration**  
   To version the URL in the repo, add a new migration (e.g. `21_seed-newfirm-trustpilot.sql`) with the `UPDATE` or `INSERT` above, then run it in Supabase.

---

**Last updated:** 2025-02-14
