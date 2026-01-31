# TICKET-016: Weekly Digest Cron Job

Automate weekly report generation and **one aggregated email per user per week**. Scheduling uses **GitHub Actions** (not Vercel cron).

## Implemented

- **`app/api/cron/send-weekly-reports/route.js`**
  - **Schedule:** Every Monday 8:00 UTC via GitHub Actions (`.github/workflows/send-weekly-reports.yml`, cron `0 8 * * 1`).
  - **Auth:** In production, requires `Authorization: Bearer <CRON_SECRET>` (GitHub Action sends this from repo secret).
  - **Logic:**
    1. **Reports:** Previous week (Mon–Sun) bounds; for each firm in `firms`, if no `weekly_reports` row for that week, call `generateWeeklyReport(firmId, weekStart, weekEnd)`.
    2. **Per user:** Distinct users from `firm_subscriptions` where `email_enabled = true`; for each user, their followed firms’ `report_json` for that week; build one HTML and send via `sendWeeklyDigest(user, reports, options)`; `last_sent_at` updated inside send-digest.
    3. **Response:** `{ success, weekStart, weekEnd, reportsGenerated, reportsSkipped, emailsSent, emailsFailed, errors, duration }`.

- **`.github/workflows/send-weekly-reports.yml`**
  - Runs Monday 8:00 UTC and on `workflow_dispatch` for manual runs.
  - **Repo secrets required:** `CRON_SECRET` (must match Vercel env), `SITE_URL` (production base URL, e.g. `https://your-app.vercel.app`).
  - Calls `GET ${SITE_URL}/api/cron/send-weekly-reports` with `Authorization: Bearer $CRON_SECRET`; fails the job if response is not 200.

- **`vercel.json`**
  - No cron entries (`crons: []`). Weekly digest is **not** run by Vercel cron.

## Environment

- **CRON_SECRET** (optional in dev): In production, set in **Vercel** env and in **GitHub repo secrets** so the GitHub Action can authorize the request.
- **SITE_URL** in GitHub repo secrets: production base URL used by the workflow to call the API.
- **RESEND_API_KEY**, **SUPABASE_SERVICE_ROLE_KEY**, **OPENAI_API_KEY**, **NEXT_PUBLIC_SITE_URL** (for digest links).

## How to test (manual trigger)

1. **Local:** Call the route with a Bearer token if you set `CRON_SECRET`:
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" "http://localhost:3000/api/cron/send-weekly-reports"
   ```
   Or without auth in dev (if `CRON_SECRET` is unset, route allows the request).

2. **GitHub Actions:** After deploy, run the workflow manually: Actions → "Send Weekly Reports (Digest)" → Run workflow. Ensure repo secrets `CRON_SECRET` and `SITE_URL` are set.

3. **Check response:** In the workflow run, view the "Invoke weekly reports API" step output for `reportsGenerated`, `reportsSkipped`, `emailsSent`, `emailsFailed`, and any `errors`.

## Dependencies

- TICKET-010 (Weekly Report Generator), TICKET-015 (Email Delivery).
