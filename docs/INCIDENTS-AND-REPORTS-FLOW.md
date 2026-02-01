# Incidents and weekly reports – flow

## 1. Daily incident check → `weekly_incidents`

- **What:** A **daily** cron runs incident detection for the **current week** (Mon–Sun) for every supported firm.
- **How:** For each firm we call `detectIncidents(firmId, currentWeekStart, currentWeekEnd)`. That reads classified reviews in that window, groups by category (spike + severity override), generates AI summaries, **deletes** that firm+week’s rows in `weekly_incidents`, and **inserts** the new ones.
- **Result:** `weekly_incidents` for the current week is updated every day so “Recent Intelligence” and APIs stay up to date.

**Artifacts:** [scripts/run-daily-incidents.ts](scripts/run-daily-incidents.ts), [.github/workflows/run-daily-incidents.yml](.github/workflows/run-daily-incidents.yml).

**Backfilling `weekly_incidents` (one-off):** After you have AI-classified data in `trustpilot_reviews`, run:

```bash
npx tsx scripts/backfill-weekly-incidents.ts [weeksBack]
```

Example: `npx tsx scripts/backfill-weekly-incidents.ts 12` backfills the last 12 weeks for all supported firms. Default is 12 weeks. Uses the same `detectIncidents()` logic (delete that firm+week, insert), so re-running is safe.

---

## 2. Weekly reports sending job → uses incident data

- **What:** A **weekly** cron (e.g. Monday 8:00 UTC) triggers the “send weekly reports” API.
- **How:** That API generates the **previous** week’s report for each firm. For each firm it calls `generateWeeklyReport(firmId, previousWeekStart, previousWeekEnd)`, which:
  1. Fetches payouts and reviews for that week.
  2. Calls **`detectIncidents(firmId, previousWeekStart, previousWeekEnd)`** → computes incidents for that week, **writes them to `weekly_incidents`**, and returns them.
  3. Builds the report JSON (payouts, trustpilot summary, **incidents**, “Our Take”).
  4. Stores the report in `weekly_reports` and uses it for the digest email.
- **So:** The weekly report (and the email) **are based on incident data**. That data is produced by **calling** `detectIncidents` at report time (not by reading from `weekly_incidents`). The same call also **writes** to `weekly_incidents`, so last week’s incidents are stored for APIs and UI.

**Summary:** Weekly report job runs weekly → for each firm it **computes** incidents for the previous week (and stores them in `weekly_incidents`) → report JSON includes those incidents → email is sent from that report. So yes: the weekly sending job is based on incident data; that data is computed at report time and also written to `weekly_incidents`.
