# Sprint 12 Scope — Site Reliability, Monitoring & Daily Reports

**Sprint Goal:** Fix two display bugs, ship the daily admin email, add Gmail ingest visibility, and make admin alert emails configurable for multiple addresses.

**Date:** 2026-03-13
**Status:** PM-reviewed ✅ (revised based on feedback)

---

## What Was Deferred (vs. Original Draft)

- ~~Area 4: Weekly admin report email~~ → S13 (trend analysis requires historical metrics storage not yet built)
- ~~Area 7: /admin/alerts with AI rule creation~~ → S13 (full product; hardcoded defaults ship this sprint instead)
- ~~Area 8: "Send Alert Now" override button~~ → S13 (nice-to-have, daily report covers the need)

---

## Area 1: /propfirms Page — Latest Payout Consistency + Zero-Data Alert

### Problem
The "Latest Payout" column should show the same value across all period tabs (24H, 7D, 30D, 12M) since it reflects the most recent payout ever, independent of the selected window. A shared 60s-TTL `firm-profiles` cache already exists for this — we need to verify it's actually working in production and add an integration test.

Separately, if any active firm returns `$0` total payouts OR `payout_count = 0` for a period, it means the data pipeline failed. This should trigger an alert, not silently display zero.

### Goals

1. **Verify + test latestPayout consistency** — confirm the shared `propfirms:firm-profiles` cache is correctly injecting `latestPayoutAt` for all period responses. Add a regression test. If broken, fix it.

2. **Zero-data alert in daily report** — fold zero-payout detection into the daily report cron (Area 3), not as a real-time alert. Condition: active firm + any period + `payout_count = 0`. Exclude firms added within the last 7 days to avoid false positives on new entries.

3. **Admin email config** — introduce `ADMIN_ALERT_EMAILS` env var (comma-separated). Default: `jasonusca@gmail.com`. All outgoing alert/report emails use this list. Graceful fallback: if `ADMIN_ALERT_EMAILS` is not set, fall back to existing `ALERT_EMAIL`. Deprecate `ALERT_EMAIL`.

---

## Area 2: Admin Dashboard — URL State Sync

### Problem
`/admin/dashboard` has no URL state. Switching Firms/Traders/System sections or sub-tabs (Payouts & Data, Daily 1–Scrape, etc.) doesn't update the URL. Refresh and share links always land on the default view.

### Goals

1. **URL params:** `/admin/dashboard?section=firms&tab=daily-scrape`
2. On page load, read `section` and `tab` from URL and activate the correct view.
3. On tab/section change, push to URL using `useRouter` + `useSearchParams` (Next.js App Router pattern).
4. Browser back/forward navigates between previously viewed tabs.
5. Invalid param values fall back to defaults silently.

**Supported values:**

| `section` | `tab` values |
|-----------|-------------|
| `firms` | `payouts`, `daily-scrape`, `daily-classify`, `daily-incidents`, `weekly-reports`, `weekly-digest`, `twitter`, `email-ingest` |
| `traders` | (default view, no sub-tabs) |
| `system` | (default view, no sub-tabs) |

---

## Area 3: Daily Admin Report Email

### Problem
No consolidated morning email. Admin has to manually visit the dashboard to know if anything failed overnight.

### Specification

**Schedule:** GitHub Actions cron, daily at 7:00 AM UTC
**New files:** `scripts/send-daily-admin-report.ts`, `lib/email/daily-admin-report.ts`, `.github/workflows/daily-admin-report.yml`
**Recipients:** `ADMIN_ALERT_EMAILS`

**Email sections:**

**Section A — Pipeline Health**

| Pipeline | Source | Fields shown |
|----------|--------|-------------|
| Daily 1: Scrape | `cron_last_run` where `job_name = 'scrape-trustpilot'` | last_run_at, firms scraped, reviews found, errors |
| Daily 2: Classify | `cron_last_run` where `job_name = 'classify-reviews'` | last_run_at, classified count, backlog count, errors |
| Daily 3: Incidents | `cron_last_run` where `job_name = 'detect-incidents'` | last_run_at, incidents generated, firms affected, errors |
| Email Ingest | `cron_last_run` where `job_name = 'ingest-firm-emails'` | last_run_at, processed, inserted, skipped, errors |

Status logic per pipeline:
- 🔴 CRITICAL: last_run_at > 25 hours ago OR errors > 0
- 🟡 WARNING: last_run_at > 12 hours ago
- 🟢 OK: ran within 12 hours, no errors

**Section B — Data Alerts**

- Any active firm (added > 7 days ago) with `payout_count = 0` for any period → listed by firm name + period
- Any pipeline with last_run_at > 25 hours ago (duplicated from Section A for visibility)
- Classifier backlog > 500 unclassified reviews

If no alerts: "✅ All systems nominal"

**Section C — Content Ingested (Last 24h)**

From `firm_content_items` where `created_at > now() - 24h`:
- Total new items: N
- Breakdown by `content_type`: company_news: N, rule_change: N, promotion: N, other: N
- Firms with new content: [list of firm names]

If nothing: "No new content ingested in the last 24 hours."

**Email format:** HTML with clear section headers, status color-coding, and a link to the admin dashboard.

---

## Area 4: Gmail Ingest — Admin Dashboard Sub-tab

### Problem
The Gmail ingest pipeline (runs every 15 min) has zero visibility in the admin dashboard. Can't tell if it's running, erroring, or stalled.

### Goals

Add a new sub-tab **"Email Ingest"** under the Firms section (after Twitter):

**Display:**
- Last run timestamp (relative, e.g. "3 min ago")
- Stats from latest `cron_last_run` result_json: `processed`, `inserted`, `skipped`, `errors`
- Status badge: OK (errors=0, last_run < 30 min ago) / WARNING (errors > 0 or last_run 30–60 min ago) / CRITICAL (last_run > 60 min ago)
- Last 5 runs table (time + inserted count + error count)

**Status thresholds:**
- OK: last_run_at within 30 min, errors = 0
- WARNING: last_run_at within 60 min OR errors > 0
- CRITICAL: last_run_at > 60 min ago

---

## Area 5: Twitter Tab — Fix Stale Display

### Problem
The Twitter sub-tab still shows per-firm keyword search stats. Since S10, the pipeline uses a hybrid 2-run model: Run 1 = combined `from:` query for all firm official accounts, Run 2 = industry keyword run. The dashboard shows outdated information.

### Goals

Replace the Twitter sub-tab content with:
- **Run 1 (Firm Official):** last run time, tweets ingested, tweets skipped (deduped)
- **Run 2 (Industry):** last run time, tweets ingested, tweets skipped
- **Topic Groups:** count of groups generated in last run, last run time
- **Errors:** any errors from last run (from `cron_last_run` result_json)
- Remove all per-firm keyword search columns

Source: `cron_last_run` where `job_name` matches twitter fetch jobs.

---

## Area 6: Hardcoded Default Alert Rules (in config)

Defer the full `/admin/alerts` page to S13. This sprint: define default alert thresholds as constants in `lib/alerts.js` (or a new `lib/alert-rules.ts`) so they're at least documented and easy to edit without hunting through route handlers.

**Default rules to codify:**
- Scraper not run in > 25 hours → WARNING
- Classifier backlog > 500 → WARNING
- Gmail ingest not run in > 60 min → WARNING
- Any pipeline error count > 0 → CRITICAL
- Active firm (> 7 days old) with payout_count = 0 → WARNING

These constants are used by both the daily report script and the existing `/api/admin/metrics` alerts.

---

## Success Criteria

- [ ] `/propfirms` — `latestPayout` is the same value across all 4 period tabs (verified + tested)
- [ ] `ADMIN_ALERT_EMAILS` env var works with multiple addresses; fallback to `ALERT_EMAIL` if not set
- [ ] Admin dashboard URL updates when switching sections/tabs; refresh restores correct view
- [ ] Daily report email arrives at 7 AM UTC with Sections A, B, C
- [ ] Gmail Ingest sub-tab appears in admin dashboard with correct status indicators
- [ ] Twitter sub-tab shows hybrid 2-run model stats (no per-firm keyword columns)
- [ ] Alert thresholds centralized in one config location

---

## Files to Create / Modify

| File | Action | Area |
|------|--------|------|
| `scripts/send-daily-admin-report.ts` | Create | 3 |
| `lib/email/daily-admin-report.ts` | Create | 3 |
| `.github/workflows/daily-admin-report.yml` | Create | 3 |
| `lib/alerts.ts` (or `lib/alert-rules.ts`) | Create/Modify | 6 |
| `app/admin/dashboard/page.js` | Modify | 2, 4, 5 |
| `app/api/admin/metrics/route.js` | Modify | 5 |
| `app/api/v2/propfirms/route.js` | Verify/Fix | 1 |

---

## Out of Scope (This Sprint)

- /admin/alerts page with AI rule creation → S13
- Weekly admin report email → S13
- "Send Alert Now" override button → S13
- New scraper sources
- Subscriber-facing email changes
