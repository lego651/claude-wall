# Admin monitoring dashboard (PROP-021)

The **System health** dashboard at `/admin/dashboard` shows key metrics for API usage, files, database, and cache. Access requires an authenticated user with `is_admin` (same as other `/admin/*` routes).

## Access

- **URL**: `/admin/dashboard` (or **Admin → Dashboard** in the admin nav).
- **Auth**: Log in; only users with `profiles.is_admin = true` can view the page and the metrics API.

## Metrics shown

| Section | Source | Description |
|--------|--------|-------------|
| **Arbiscan API** | `GET /api/admin/arbiscan-usage` (aggregated in metrics) | Calls today, daily limit, usage %. See [ARBISCAN-USAGE.md](./ARBISCAN-USAGE.md). |
| **Payout files** | `data/payouts` on the server | Total size (MB), file count, largest files (path + size). Files &gt;5MB are flagged. |
| **Database** | Supabase `count` queries | Row counts for `firms`, `recent_payouts`, `trustpilot_reviews`, `weekly_incidents`. |
| **Cache** | In-memory counters in `lib/cache.js` | Hits, misses, hit rate since the current process started (resets on deploy/restart). |
| **API latency / error rates** | Placeholder | P50/P95/P99 and error rates by endpoint are available in Vercel Analytics; the dashboard links to that. |

## Behaviour

- **Auto-refresh**: The page polls `GET /api/admin/metrics` every **30 seconds**.
- **Refresh now**: Button to fetch immediately.
- **Export CSV**: Downloads a CSV of the current metrics (arbiscan, files, cache, database, `fetchedAt`).

## API

- **Endpoint**: `GET /api/admin/metrics`
- **Auth**: Same as other admin APIs: session required, `profiles.is_admin` must be true.
- **Response**: JSON with `arbiscan`, `files`, `database`, `cache`, `apiLatency`, `errorRates`, `fetchedAt`.

## Files

- **Page**: `app/admin/dashboard/page.js` (client component, Tailwind + DaisyUI).
- **API**: `app/api/admin/metrics/route.js`.
- **Cache stats**: `lib/cache.js` exports `getCacheStats()` (hits/misses/hitRate).
