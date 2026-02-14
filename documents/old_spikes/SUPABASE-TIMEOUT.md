# Supabase query timeout and slow-query logging

**PROP-016:** All Supabase queries in v2 API routes and the payout sync service run with a timeout and optional slow-query log.

## Connection pooling

The Supabase JavaScript client uses the **PostgREST API** over HTTP, not a long-lived PostgreSQL connection. Connection pooling is handled by Supabase (Supavisor) on the server. The client does not accept a `db.pool` config like a raw `pg` client. For serverless (e.g. Vercel), each request gets a new client; Supabase’s pooler manages backend connections.

## Timeout and slow-query guard

- **Module:** `lib/supabaseQuery.js`
- **`withQueryGuard(promise, options)`** – Wraps any query promise with:
  - **Timeout:** Default 5s; rejects with `Error('Query timeout')` if the query doesn’t resolve in time.
  - **Slow-query log:** If the query takes ≥ 1s (default), logs a warning with `duration` and `context`.
- **`queryWithTimeout(promise, timeoutMs)`** – Timeout only (no slow-query log).

Options:

- `timeoutMs` (default `5000`)
- `slowThresholdMs` (default `1000`); set to a very large value to skip logging
- `context` – String used in logs (e.g. `'propfirms firms'`)

## Where it’s applied

- **`app/api/v2/propfirms/route.js`** – Firms list, recent_payouts (1d).
- **`app/api/v2/propfirms/[id]/latest-payouts/route.js`** – Firms, recent_payouts.
- **`app/api/v2/propfirms/[id]/incidents/route.js`** – weekly_incidents, trustpilot_reviews (with 500 + "Database timeout" on timeout).
- **`app/api/v2/propfirms/[id]/signals/route.js`** – Firms, trustpilot_reviews.
- **`app/api/v2/propfirms/[id]/chart/route.js`** – Firms.
- **`app/api/v2/propfirms/[id]/top-payouts/route.js`** – Firms.
- **`lib/services/payoutSyncService.js`** – recent_payouts upsert/delete, firms select/update, syncAllFirms firms fetch.

## Fallback on timeout

- **API routes:** Existing `try/catch` returns `500` with a generic error (or "Database timeout" where we map the timeout message).
- **payoutSyncService:** Timeout throws; `syncFirmPayouts` catches and sets `results.error`; sync continues for other firms.

## Tests

Route and sync tests mock Supabase; they don’t use `withQueryGuard`’s timeout in a way that would change behavior. To test timeout behavior, mock the query promise to never resolve and assert the handler returns 500 or the sync result has an error.
