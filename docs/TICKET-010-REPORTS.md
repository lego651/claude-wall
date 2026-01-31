# TICKET-010: Weekly Report Generator

**Status:** Done

---

## What it does

- **`generateWeeklyReport(firmId, weekStart, weekEnd)`** in `lib/digest/generator.ts`
- **Fetches:** Payouts (from JSON files via `loadMonthlyData`, filtered by week), Trustpilot reviews (from DB), incidents (calls `detectIncidents()` and stores to `weekly_incidents`)
- **Computes:** Payout summary (total, count, largest, avg, change vs last week), Trustpilot summary (avg rating, rating change, review count, sentiment % positive/neutral/negative)
- **AI:** Generates "Our Take" (2–3 paragraphs) from metrics + incidents (gpt-4o-mini)
- **Stores:** Full report JSON in `weekly_reports` (upsert by firm_id, week_number, year)
- **Returns:** Report object (payouts, trustpilot, incidents, ourTake, etc.)

---

## Run for a week

```bash
npx tsx scripts/run-weekly-report.ts [firmId] [weekStartYYYY-MM-DD]
```

Examples:

```bash
npx tsx scripts/run-weekly-report.ts fundednext 2026-01-27
npx tsx scripts/run-weekly-report.ts the5ers
```

- If `weekStart` is omitted, uses last week (Monday–Sunday).
- Requires: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
- Payout data comes from `data/payouts/<firmId>/YYYY-MM.json`; if a firm has no JSON files, payout summary will be zeros.

---

## Dependencies

- **TICKET-009** (incident aggregator) – `detectIncidents()` is called inside the generator.
- Payout JSON files – from sync-firm-payouts workflow (e.g. `data/payouts/fundednext/2026-01.json`).
