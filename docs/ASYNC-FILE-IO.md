# Async file I/O (payout data loader)

**PROP-015:** Payout file reads use async I/O so concurrent API requests don't block the event loop.

## Pattern

- **`loadMonthlyData(firmId, yearMonth)`** – async. Uses `fs.promises.access`, `fs.promises.stat`, and `fs.promises.readFile`. No `readFileSync` or `existsSync` in the hot path.
- **`loadPeriodData(firmId, period)`** – async. Awaits `loadMonthlyData()` for each month.
- **`getTopPayoutsFromFiles(firmId, period, limit)`** – async. Awaits `loadMonthlyData()` for each month.

## Call sites

All call sites must `await`:

- `app/api/v2/propfirms/route.js` – `await loadPeriodData(...)`
- `app/api/v2/propfirms/[id]/chart/route.js` – `await loadPeriodData(...)`
- `app/api/v2/propfirms/[id]/signals/route.js` – `await loadPeriodData(...)`
- `app/api/v2/propfirms/[id]/top-payouts/route.js` – `await getTopPayoutsFromFiles(...)`
- `lib/digest/generator.ts` – `await getPayoutSummaryForRange(...)` which awaits `loadMonthlyData(...)`

## Error handling

- File missing or unreadable: `loadMonthlyData` returns `null`, logs with `log.error`.
- Invalid JSON: `JSON.parse` throws; caught and logged, returns `null`.
- Callers treat `null` as "no data" (empty summary or 404 as appropriate).

## Sync helpers

- **`getAvailableMonths(firmId)`** remains synchronous (`readdirSync`). It's used by `loadPeriodData` to decide which months to load; the heavy work is the async `loadMonthlyData` calls.
