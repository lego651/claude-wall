# Alerts & monitoring summary (26-ticket spike)

Summary of what was implemented across the PROP tickets and how to verify it works.

---

## 1. Short summary

| Area | What was done | Ticket(s) |
|------|----------------|-----------|
| **Structured logging** | Pino logger with request context; used in API routes and services. | PROP-004 |
| **Error tracking** | Sentry (client, server, edge). Errors and unhandled rejections reported. | PROP-005 |
| **File size monitoring** | Script `scripts/check-file-sizes.js`; CI workflow runs daily, fails if any file ≥10 MB, warns if ≥5 MB. | PROP-006 |
| **Supabase timeout & slow-query** | `withQueryGuard()`: 5s timeout, logs slow queries (≥1s). Used in v2 API and payout sync. | PROP-016 |
| **Arbiscan usage tracking** | Daily call count (resets UTC midnight); 80/90/95% thresholds logged; optional Slack (or use email). | PROP-019 |
| **APM / Vercel Analytics** | `<Analytics />` in layout; `trackApiResponse()` wired in `/api/v2/propfirms`. Web Vitals + optional custom events (Pro). | PROP-020 |
| **Admin metrics dashboard** | `/admin/dashboard` and `GET /api/admin/metrics`: Arbiscan usage, file sizes, DB row counts, cache hit rate. Auto-refresh 30s; CSV export. | PROP-021 |
| **Email alerts** | `sendAlert(service, message, severity)` via Resend to `ALERT_EMAIL`. Wired: Arbiscan circuit breaker open (CRITICAL). | PROP-022 |
| **Runbooks & incident response** | `docs/RUNBOOKS.md` (Arbiscan, Supabase, file size, data overlap, rate limit, sync, DB perf); `docs/INCIDENT-RESPONSE.md` (flowchart, escalation, contacts). | PROP-024 |
| **Load testing** | k6 scripts for `/api/v2/propfirms` and firm-detail endpoints; baselines and scaling plan in `docs/PERFORMANCE-BASELINES.md`. | PROP-025 |
| **Deployment checklist** | `docs/DEPLOYMENT.md` (env, DB, tests, monitoring, deploy); `docs/POST-DEPLOY-VERIFICATION.md` (health, API, rollback). | PROP-026 |

---

## 2. How to measure it’s working

### Logging (PROP-004)
- **Check:** Run the app (e.g. `npm run dev`), hit an API (e.g. `GET /api/v2/propfirms`). In the terminal you should see structured log lines (e.g. `"route":"/api/v2/propfirms"`, `"duration":...`).
- **Check:** Trigger an error (e.g. invalid route or 500). Logs should include error level and context.

### Sentry (PROP-005)
- **Check:** Set `SENTRY_DSN` (and optionally `NEXT_PUBLIC_SENTRY_DSN`), deploy or run locally. Trigger an error (e.g. throw in an API route). Event should appear in Sentry dashboard within a few minutes.
- **Check:** Sentry project shows “Events” or “Issues” after a real or test error.

### File size monitoring (PROP-006)
- **Check:** Run `node scripts/check-file-sizes.js --format=markdown`. You should see a report; exit code 0 if no file ≥10 MB, 1 otherwise.
- **Check:** In GitHub, run the workflow that uses this script (e.g. `monitor-file-sizes.yml`). Job should fail if any file ≥10 MB; optional warning at ≥5 MB.

### Supabase timeout / slow-query (PROP-016)
- **Check:** In logs, if a Supabase query takes ≥1s you should see a slow-query warning with `context` and `duration`. If a query exceeds 5s, the request should end with a timeout error (e.g. 500 or “Database timeout” where implemented).

### Arbiscan usage (PROP-019)
- **Check:** As an admin user, open `/admin/dashboard` or call `GET /api/admin/arbiscan-usage`. Response should include `calls`, `limit`, `percentage`, `day`.
- **Check:** After running a payout sync, logs should include current usage (calls, %). When usage crosses 80/90/95%, a warning is logged (and Slack if `SLACK_WEBHOOK_URL` is set).

### Vercel Analytics / APM (PROP-020)
- **Check:** In Vercel project → Analytics, enable Web Analytics. After some traffic, the dashboard should show page views and Web Vitals.
- **Check:** Custom events (e.g. `api_response`) need Vercel Pro/Enterprise to appear in the UI. Code path: `trackApiResponse()` is called in `/api/v2/propfirms` on each response; no error means the call is being made (events may not show on Hobby).

### Admin dashboard (PROP-021)
- **Check:** Log in as a user with `profiles.is_admin = true`, go to `/admin/dashboard`. Page should show Arbiscan, files, database counts, cache stats, and refresh every 30s.
- **Check:** `GET /api/admin/metrics` with the same auth returns JSON with `arbiscan`, `files`, `database`, `cache`, `fetchedAt`. Export CSV button should download a CSV.

### Email alerts (PROP-022)
- **Check:** Set `ALERT_EMAIL` and `RESEND_API_KEY`. When the Arbiscan circuit breaker opens (e.g. after 5 consecutive failures), the configured email should receive a CRITICAL alert.
- **Check:** If `ALERT_EMAIL` or `RESEND_API_KEY` is unset, trigger an alert path and confirm logs show a warning like `[alerts] ALERT_EMAIL not set; alert not sent` (no email, no throw).

### Runbooks & incident response (PROP-024)
- **Check:** `docs/RUNBOOKS.md` exists and has sections for Arbiscan, Supabase, file size, data overlap, rate limit, sync, DB performance. `docs/INCIDENT-RESPONSE.md` exists with flowchart, escalation table, and contact placeholders.
- **Measure:** Team runs through one runbook (e.g. “Arbiscan API down”) in a drill and confirms steps are clear.

### Load testing (PROP-025)
- **Check:** Install k6 (e.g. `brew install k6`). Start the app, run `k6 run tests/load/propfirms-list.js`. Summary should show `http_req_duration`, `http_reqs`, `http_req_failed`. Thresholds (e.g. P95 &lt; 2s) will fail the run if exceeded.
- **Check:** Run `VUS=50 k6 run tests/load/propfirms-list.js` and note P95/P99 and throughput in the summary.

### Deployment & post-deploy (PROP-026)
- **Check:** `docs/DEPLOYMENT.md` lists env vars, DB, tests, monitoring, and deploy steps. Execute the checklist (set env in Vercel, run migration, run tests, deploy).
- **Check:** After deploy, follow `docs/POST-DEPLOY-VERIFICATION.md`: homepage and `/propfirms` load, API returns 200, Vercel deployment “Ready”, Sentry/Analytics receiving data.

---

## Quick verification checklist

- [ ] Logs show structured fields when hitting an API (PROP-004).
- [ ] Sentry receives a test error when `SENTRY_DSN` is set (PROP-005).
- [ ] `node scripts/check-file-sizes.js` runs and exits 0 or 1 as expected (PROP-006).
- [ ] Admin user can open `/admin/dashboard` and see metrics (PROP-019, PROP-021).
- [ ] `GET /api/admin/arbiscan-usage` returns `calls`, `limit`, `percentage` (PROP-019).
- [ ] Vercel Analytics shows traffic after enabling (PROP-020).
- [ ] With `ALERT_EMAIL` set, circuit breaker opening sends an email (PROP-022).
- [ ] `k6 run tests/load/propfirms-list.js` completes and prints a summary (PROP-025).
- [ ] RUNBOOKS.md and INCIDENT-RESPONSE.md exist and are filled where needed (PROP-024).
