# Response Caching (Vercel KV)

Response caching uses **Vercel KV** (Redis) to reduce load on the API and file-based payout data. When KV is not configured, the cache is disabled and all operations are no-ops (get returns null, set/invalidate do nothing).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KV_REST_API_URL` | Yes (for caching) | Vercel KV REST API URL |
| `KV_REST_API_TOKEN` | Yes (for caching) | Vercel KV REST API token |

If either is missing, `lib/cache` never initializes the client and all cache calls are no-ops.

## What is cached

| Layer | Key shape | TTL | Used by |
|-------|-----------|-----|---------|
| Propfirms list | `propfirms:${period}:${sort}:${order}` | 5 min (300s) | `GET /api/v2/propfirms` |
| Chart | `chart:${firmId}:${period}` | 10 min (600s) | `GET /api/v2/propfirms/[id]/chart` |
| Top payouts | `top-payouts:${firmId}:${period}` | 30 min (1800s) | `GET /api/v2/propfirms/[id]/top-payouts` |
| Monthly payout data | `payout:${firmId}:${yearMonth}` | 5 min (300s) | `lib/services/payoutDataLoader.js` (loadMonthlyData) |

## Usage

- **API routes** check cache before building the response and set the cache after building.
- **payoutDataLoader** checks cache in `loadMonthlyData` before reading files and sets cache after a successful read.

## Invalidation

Use `cache.invalidate(pattern)` with a Redis-style glob pattern, e.g.:

- `propfirms:*` – clear all list caches
- `chart:*` – clear all chart caches
- `top-payouts:*` – clear all top-payouts caches
- `payout:${firmId}:*` – clear monthly data for one firm

Invalidation is optional; entries expire by TTL if not invalidated.

## Implementation

- **Module:** `lib/cache.js` – `get(key)`, `set(key, value, ttlSeconds)`, `invalidate(pattern)`.
- **Lazy init:** KV client is created on first use when env is set.
- **Errors:** get/set/invalidate catch errors, log, and fail gracefully (get returns null, set/invalidate no-op).
