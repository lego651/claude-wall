# TICKET-009: Incident Aggregator

**Status:** Done

---

## What it does

- **`detectIncidents(firmId, weekStart, weekEnd)`** in `lib/digest/incident-aggregator.ts`
- Fetches reviews in date range with `category IN ('payout_issue', 'scam_warning', 'platform_issue', 'rule_violation')`
- Groups by category; if **3+ reviews** in same category → creates one incident
- Uses **AI** (gpt-4o-mini) to generate: **title**, **summary**, **affected_users** from review summaries
- Derives **severity** from max of review severities (high > medium > low)
- **Stores** in `weekly_incidents` (replaces existing incidents for that firm/week/year)

---

## Run for a week

```bash
npx tsx scripts/run-incident-aggregator.ts [firmId] [weekStartYYYY-MM-DD]
```

Examples:

```bash
npx tsx scripts/run-incident-aggregator.ts fundednext 2026-01-22
npx tsx scripts/run-incident-aggregator.ts the5ers
```

- If `weekStart` is omitted, uses last week (Monday–Sunday).
- Requires: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

---

## Test on historical data (Week of Jan 22–28)

Use a Monday in that week:

```bash
npx tsx scripts/run-incident-aggregator.ts fundednext 2026-01-20
```

(Adjust year if needed; Jan 22 2026 is a Thursday, so week start is Jan 20 2026.)

---

## Dependencies

- **TICKET-006** (classifier) – reviews must have `category` and `ai_summary` (run batch classification first).
- **Week utils** – `lib/digest/week-utils.ts` (ISO week number/year, week bounds).
