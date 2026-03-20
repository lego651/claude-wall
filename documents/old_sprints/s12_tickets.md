# Sprint 12 Tickets — Site Reliability, Monitoring & Daily Reports

**Sprint Goal:** Fix two display bugs, ship the daily admin email, add Gmail ingest visibility, and make admin alert emails configurable for multiple addresses.

**Scope:** [s12_scope.md](./s12_scope.md)
**Date:** 2026-03-13
**Total story points:** 26

---

## Implementation Order

```
Day 1:   S12-012 (alert-rules constants — unblocks everything)
Day 1:   S12-003 (ADMIN_ALERT_EMAILS env var)
Day 1-2: S12-001 (verify latestPayout consistency)
Day 2:   S12-004 (URL sync — read params on load)
Day 2:   S12-005 (URL sync — write params on nav) ← depends on S12-004
Day 3:   S12-006 (daily report lib — core logic) ← depends on S12-012, S12-003
Day 3:   S12-011 (Twitter tab fix — independent)
Day 4:   S12-007 (daily report script) ← depends on S12-006
Day 4:   S12-009 (Gmail ingest API) ← depends on S12-012
Day 4:   S12-008 (GitHub Actions workflow) ← depends on S12-007
Day 5:   S12-010 (Gmail ingest UI) ← depends on S12-009, S12-004
Day 5:   S12-002 (zero-data alert, folds into S12-006)
```

---

## Summary

| Ticket | Title | Points | Priority | Area |
|--------|-------|--------|----------|------|
| S12-012 | Centralize alert thresholds in `lib/alert-rules.ts` | 1 | P0 | 6 |
| S12-001 | Verify + test `latestPayoutAt` consistency across period tabs | 3 | P0 | 1 |
| S12-002 | Zero-data alert in daily report | 2 | P1 | 1 |
| S12-003 | `ADMIN_ALERT_EMAILS` env var with graceful fallback | 2 | P1 | 1 |
| S12-004 | Admin dashboard URL state — read params on load | 2 | P1 | 2 |
| S12-005 | Admin dashboard URL state — write params on navigation | 2 | P1 | 2 |
| S12-006 | Daily admin report — `lib/email/daily-admin-report.ts` | 5 | P0 | 3 |
| S12-007 | Daily admin report — `scripts/send-daily-admin-report.ts` | 2 | P0 | 3 |
| S12-008 | Daily admin report — GitHub Actions workflow | 1 | P0 | 3 |
| S12-009 | Gmail ingest sub-tab — API endpoint | 2 | P1 | 4 |
| S12-010 | Gmail ingest sub-tab — UI component | 3 | P1 | 4 |
| S12-011 | Twitter tab — replace stale display with 2-run model | 3 | P1 | 5 |

**Total: 28 points**

---

## TICKET-S12-012: Centralize Alert Thresholds in `lib/alert-rules.ts`

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 1
**Area:** 6

**Description:** Create a single source of truth for all alert threshold constants used by the daily report, admin metrics endpoints, and future alerting logic. Prevents thresholds from drifting out of sync across files.

**Acceptance criteria:**
- [ ] `lib/alert-rules.ts` exports named constants: `SCRAPER_STALE_HOURS = 25`, `CLASSIFIER_BACKLOG_THRESHOLD = 500`, `EMAIL_INGEST_STALE_MINUTES = 60`, `PIPELINE_ERROR_THRESHOLD = 0`, `PAYOUT_ZERO_FIRM_MIN_AGE_DAYS = 7`
- [ ] All constants are typed `const`, exported individually (not as default object)
- [ ] `app/api/admin/metrics/route.js` updated to import from this file if it has hardcoded values
- [ ] Unit test confirms each exported value (guards against accidental edits)
- [ ] ≥80% line coverage

**Implementation notes:**
- Pure constants file — no functions, no async, no imports
- Add JSDoc comments to each constant noting the unit (hours/minutes/days/count)
- Complete this ticket first — other tickets in Areas 1, 3, and 4 depend on it

**Files:** `lib/alert-rules.ts` (new), `lib/alert-rules.test.ts` (new), `app/api/admin/metrics/route.js` (modify)

**Dependencies:** (none)

---

## TICKET-S12-001: Verify + Test `latestPayoutAt` Consistency Across Period Tabs

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 3
**Area:** 1

**Description:** The dual-cache architecture injects `latestPayoutAt` from a shared `propfirms:firm-profiles` cache (60s TTL) into all period-specific responses. Verify this is actually working and add a regression test to prevent regressions.

**Acceptance criteria:**
- [ ] Code audit confirms `latestPayoutAt` is injected from shared firm-profiles cache into every period response (not computed independently per period)
- [ ] Regression test covers all four period variants (1d, 7d, 30d, 12m) — each response for the same firm contains the same `latestPayoutAt`
- [ ] Test mocks the cache to force a stale period-specific cache hit and confirms the shared profile value still wins
- [ ] If broken: fix the merge order so `{ ...periodData, ...firmProfile }` (profile wins)
- [ ] `npm run build` and `npm run lint` pass clean

**Implementation notes:**
- Read `app/api/v2/propfirms/route.js` — confirm merge order: period-specific cache must never overwrite `latestPayoutAt` from firm-profiles cache
- Test at `app/api/v2/propfirms/route.test.js` — mock `@/lib/cache` to return controlled fixtures per cache key

**Files:** `app/api/v2/propfirms/route.js` (verify/fix), `app/api/v2/propfirms/route.test.js` (new/modify)

**Dependencies:** (none)

---

## TICKET-S12-002: Zero-Data Alert in Daily Report

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 2
**Area:** 1

**Description:** Active firms (added > 7 days ago) that return `payout_count = 0` for any period represent a data pipeline failure. Surface this as an alert in Section B of the daily admin report email.

**Acceptance criteria:**
- [ ] Query identifies active firms where `created_at < now() - PAYOUT_ZERO_FIRM_MIN_AGE_DAYS days` AND `payout_count = 0` for any period
- [ ] Result included in daily report Section B under "Data Alerts"
- [ ] Threshold constant imported from `lib/alert-rules.ts`
- [ ] Unit tests cover: no affected firms, one affected firm, multiple affected firms
- [ ] ≥80% line coverage

**Implementation notes:**
- This ticket's logic lives inside `lib/email/daily-admin-report.ts` (TICKET-S12-006)
- Determine which table/field stores `payout_count` per period — likely in the cached JSON or a summary table
- Do not cache this query — runs once per daily report execution

**Files:** `lib/email/daily-admin-report.ts` (modify — add zero-data alert query)

**Dependencies:** TICKET-S12-012, TICKET-S12-006

---

## TICKET-S12-003: `ADMIN_ALERT_EMAILS` Env Var with Graceful Fallback

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 2
**Area:** 1

**Description:** Introduce `ADMIN_ALERT_EMAILS` (comma-separated) to replace the single-recipient `ALERT_EMAIL`. All alert and report emails use this list. Graceful fallback so existing deployments don't break.

**Acceptance criteria:**
- [ ] `ADMIN_ALERT_EMAILS` is parsed: split on comma, each address trimmed
- [ ] Fallback chain: `ADMIN_ALERT_EMAILS` → `ALERT_EMAIL` → `jasonusca@gmail.com`
- [ ] Helper `getAdminAlertEmails(): string[]` exported from `lib/alerts.js` and used by both alert system and daily report script
- [ ] Existing `sendAlert` calls continue to work without modification
- [ ] `ALERT_EMAIL` marked deprecated in a comment but not removed
- [ ] Unit test covers: both vars set (ADMIN wins), only `ALERT_EMAIL` set, neither set (default), multi-address parsing, log warning if array is empty

**Implementation notes:**
- Resend `to` field accepts `string[]` — pass the array directly
- Document `ADMIN_ALERT_EMAILS` in `.env.example`

**Files:** `lib/alerts.js` (modify), `lib/alerts.test.js` (modify)

**Dependencies:** (none)

---

## TICKET-S12-004: Admin Dashboard URL State — Read Params on Load

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 2
**Area:** 2

**Description:** On page load, read `?section=` and `?tab=` from the URL and initialize the dashboard to the correct view, so bookmarks and shared links land on the right tab.

**Acceptance criteria:**
- [ ] `useSearchParams()` used to initialize `section` and `tab` state on mount
- [ ] Valid sections: `firms`, `traders`, `system`; invalid → default `firms`
- [ ] Valid tabs under `firms`: `payouts`, `daily-scrape`, `daily-classify`, `daily-incidents`, `weekly-reports`, `weekly-digest`, `twitter`, `email-ingest`; invalid → default `payouts`
- [ ] Tab validation is section-aware
- [ ] No hydration mismatch

**Implementation notes:**
- `useSearchParams()` must be inside a `Suspense` boundary in Next.js 15 — verify or add one
- Define `VALID_TABS: Record<string, string[]>` as module-level constant for clean validation
- Read params at render time (not in `useEffect`) so state is initialized before first paint

**Files:** `app/admin/dashboard/page.js` (modify)

**Dependencies:** (none)

---

## TICKET-S12-005: Admin Dashboard URL State — Write Params on Navigation

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 2
**Area:** 2

**Description:** When section or tab changes, update the URL so browser back/forward navigation works and the current view is always shareable/bookmarkable.

**Acceptance criteria:**
- [ ] Clicking a section: updates `?section=`, resets `?tab=` to default for that section
- [ ] Clicking a tab: updates `?tab=` without changing `?section=`
- [ ] `router.push` used (not `router.replace`) to preserve history
- [ ] Browser back/forward navigates between section/tab combinations
- [ ] No infinite re-render loops

**Implementation notes:**
- Build `buildDashboardUrl(section, tab): string` helper for clean URL construction
- Use `useSearchParams` + `useRouter` from `next/navigation`
- Only call `router.push` when the derived URL differs from current `window.location.search`

**Files:** `app/admin/dashboard/page.js` (modify)

**Dependencies:** TICKET-S12-004

---

## TICKET-S12-006: Daily Admin Report — `lib/email/daily-admin-report.ts`

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 5
**Area:** 3

**Description:** Core module for the daily admin report. Queries `cron_last_run`, `firm_content_items`, and firm profile tables, then renders a color-coded HTML email covering pipeline health, data alerts, and content ingested.

**Acceptance criteria:**
- [ ] `buildDailyAdminReport(): Promise<{ subject: string; html: string }>` is the primary export
- [ ] Section A: fetches `cron_last_run` for job names `scrape-trustpilot`, `classify-reviews`, `detect-incidents`, `ingest-firm-emails`; parses `result_json`; applies status logic (CRITICAL/WARNING/OK from `lib/alert-rules.ts`)
- [ ] Section B: zero-data firms alert (from S12-002), stale pipelines > 25h, classifier backlog > 500
- [ ] Section C: `firm_content_items` inserted in last 24h — total, by `content_type`, list of firms
- [ ] HTML uses inline styles; status colors: CRITICAL = `#dc2626`, WARNING = `#d97706`, OK = `#16a34a`
- [ ] Admin dashboard link in email footer
- [ ] Unit tests cover: all-OK, mixed statuses, empty Section C, zero-data firms present
- [ ] ≥80% line coverage

**Implementation notes:**
- Use Supabase service-role client (`@/lib/supabase/service`) — runs outside user request context
- Status: CRITICAL if `last_run_at` is null OR `(now - last_run_at) > 25h` OR `result_json.errors > 0`; WARNING if `> 12h`; OK otherwise
- Split into `fetchReportData()` (async, DB) and `renderReportHtml(data)` (pure, string) for testability

**Files:** `lib/email/daily-admin-report.ts` (new), `lib/email/daily-admin-report.test.ts` (new)

**Dependencies:** TICKET-S12-012, TICKET-S12-003

---

## TICKET-S12-007: Daily Admin Report — `scripts/send-daily-admin-report.ts`

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 2
**Area:** 3

**Description:** Thin orchestration script that calls `buildDailyAdminReport()`, sends the result via Resend to all admin addresses, and exits non-zero on failure so GitHub Actions marks the run as failed.

**Acceptance criteria:**
- [ ] `import 'dotenv/config'` is the first line
- [ ] Calls `buildDailyAdminReport()` from `lib/email/daily-admin-report.ts`
- [ ] Sends via Resend to all addresses from `getAdminAlertEmails()`
- [ ] Logs success with recipient count and timestamp
- [ ] On any error: logs the error, calls `process.exit(1)`
- [ ] Runnable locally: `npx ts-node scripts/send-daily-admin-report.ts`

**Implementation notes:**
- Import Resend from `@/lib/resend` — do not instantiate a second client
- Subject: `Daily Admin Report — YYYY-MM-DD`
- No test file needed (thin orchestration; logic is in the lib module)

**Files:** `scripts/send-daily-admin-report.ts` (new)

**Dependencies:** TICKET-S12-006, TICKET-S12-003

---

## TICKET-S12-008: Daily Admin Report — GitHub Actions Workflow

**Status:** 🔲 Pending
**Priority:** P0
**Story points:** 1
**Area:** 3

**Description:** GitHub Actions workflow that runs `scripts/send-daily-admin-report.ts` daily at 7:00 AM UTC.

**Acceptance criteria:**
- [ ] Workflow at `.github/workflows/daily-admin-report.yml`
- [ ] Schedule: `cron: '0 7 * * *'`
- [ ] Node.js version matches project (check `.nvmrc` or `package.json`)
- [ ] Dependencies installed with `npm ci`
- [ ] Runs: `npx ts-node --project tsconfig.json scripts/send-daily-admin-report.ts`
- [ ] Secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_ALERT_EMAILS`
- [ ] `workflow_dispatch` trigger for manual runs
- [ ] `timeout-minutes: 10` set

**Implementation notes:**
- Mirror Node.js setup pattern from existing workflows in `.github/workflows/`
- Use service role key only — do not inject `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Files:** `.github/workflows/daily-admin-report.yml` (new)

**Dependencies:** TICKET-S12-007

---

## TICKET-S12-009: Gmail Ingest Sub-tab — API Endpoint

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 2
**Area:** 4

**Description:** New admin API endpoint returning the last 5 runs of the `ingest-firm-emails` job from `cron_last_run`, including parsed stats and computed status for the dashboard tab.

**Acceptance criteria:**
- [ ] `GET /api/admin/email-ingest/stats` returns: `lastRun` (ISO or null), `stats` (processed/inserted/skipped/errors from latest run's `result_json`), `status` (OK/WARNING/CRITICAL), `recentRuns` (last 5 rows DESC)
- [ ] Status: OK if errors=0 and last_run < 30min; WARNING if errors > 0 OR last_run 30–60min; CRITICAL if last_run > 60min or no runs found
- [ ] Thresholds imported from `lib/alert-rules.ts`
- [ ] Route protected — admin auth only (match existing admin route pattern)
- [ ] Returns 200 with `status: 'CRITICAL'` even when no runs exist — not 404
- [ ] Unit test covers all three status cases + no-runs case; ≥80% coverage

**Implementation notes:**
- Use optional chaining on `result_json` fields — shape may vary across runs; default all numerics to 0
- Check `app/api/admin/` for existing auth middleware pattern and replicate exactly

**Files:** `app/api/admin/email-ingest/stats/route.js` (new), `app/api/admin/email-ingest/stats/route.test.js` (new)

**Dependencies:** TICKET-S12-012

---

## TICKET-S12-010: Gmail Ingest Sub-tab — UI Component

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 3
**Area:** 4

**Description:** Add the "Email Ingest" tab UI under the Firms section in the admin dashboard, showing last run time, stats, status badge, and a table of the last 5 runs.

**Acceptance criteria:**
- [ ] Tab appears in Firms section nav with slug `email-ingest`
- [ ] Displays: last run timestamp (relative), stats row (processed / inserted / skipped / errors), status badge (green/amber/red)
- [ ] Table: last 5 runs with columns Time, Inserted, Errors
- [ ] Data fetched from `GET /api/admin/email-ingest/stats` lazily (only on tab activation)
- [ ] Loading + error states handled
- [ ] Visual style matches existing admin dashboard tabs

**Implementation notes:**
- Fetch gated on `activeTab === 'email-ingest'` via `useState` + `useEffect`
- Reuse existing date formatting utility in the dashboard before writing a new one
- Status badge colors must use Tailwind/DaisyUI classes already in use elsewhere

**Files:** `app/admin/dashboard/page.js` (modify), `components/admin/EmailIngestTab.jsx` (new), `components/admin/EmailIngestTab.test.jsx` (new)

**Dependencies:** TICKET-S12-009, TICKET-S12-004

---

## TICKET-S12-011: Twitter Tab — Replace Stale Display with 2-Run Model

**Status:** 🔲 Pending
**Priority:** P1
**Story points:** 3
**Area:** 5

**Description:** The Twitter sub-tab still shows per-firm keyword columns from the old pipeline model. Replace with a display of the hybrid 2-run model (Run 1: firm official, Run 2: industry), sourced from `cron_last_run`.

**Acceptance criteria:**
- [ ] Per-firm keyword columns removed
- [ ] Run 1 "Firm Official" card: last run time, tweets ingested, skipped, errors
- [ ] Run 2 "Industry" card: last run time, tweets ingested, skipped, errors
- [ ] Topic Groups row: count generated, last run time
- [ ] Errors > 0 highlighted in red
- [ ] New `GET /api/admin/twitter/stats` endpoint returns structured data from `cron_last_run`
- [ ] Handles never-run state gracefully ("Never" for time, 0 for counts)
- [ ] Unit tests for API route; ≥80% coverage

**Implementation notes:**
- Identify exact `job_name` strings for Twitter jobs by scanning `scripts/` and `.github/workflows/` before building
- Topic Groups may be a separate job name — check `cron_last_run` in DB or scripts

**Files:** `app/api/admin/twitter/stats/route.js` (new), `app/api/admin/twitter/stats/route.test.js` (new), `app/admin/dashboard/page.js` (modify), `components/admin/TwitterStatsTab.jsx` (new), `components/admin/TwitterStatsTab.test.jsx` (new)

**Dependencies:** (none)
