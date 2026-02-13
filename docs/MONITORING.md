# Monitoring & APM (PROP-020)

Application performance monitoring is provided by **Vercel Web Analytics** and optional custom events.

## Setup

1. **Enable in Vercel**: Project → Settings → Analytics → enable **Web Analytics**.
2. **Package**: `@vercel/analytics` is installed; `<Analytics />` is in `app/layout.js`.
3. **Custom events** (e.g. `api_response`, `arbiscan_call`, `cache_result`) require **Vercel Pro or Enterprise** to appear in the dashboard. On Hobby, page views and Web Vitals are still collected.

## Metrics We Track

| Metric | Source | Description |
|--------|--------|-------------|
| **API response time** | `lib/analytics.js` → `trackApiResponse(route, durationMs, status)` | Per-route latency and status. Wired in `/api/v2/propfirms`; add to other routes as needed. |
| **Arbiscan usage** | `lib/arbiscan.js` + `GET /api/admin/arbiscan-usage` | Daily call count and % of limit. See [ARBISCAN-USAGE.md](./ARBISCAN-USAGE.md). |
| **Cache hit/miss** | `lib/cache.js` (optional) | Use `trackCacheResult(key, 'hit'|'miss')` from `lib/analytics.js` where cache is checked. |
| **File I/O** | Optional | Can call custom `track()` from `@vercel/analytics/server` in `loadMonthlyData` or similar if needed. |
| **Web Vitals** | Vercel Analytics (automatic) | LCP, FID, CLS, etc. |

## Performance Budgets

Target SLAs for API latency (P95):

- **1d period** (Supabase): P95 &lt; **500 ms**
- **12m period** (file-based): P95 &lt; **2 s**

Set these as internal targets; enforce via alerts where your APM supports it.

## Alerts for SLA Violations

- **Vercel**: Use **Speed Insights** and **Analytics** in the dashboard; set up **Vercel Notifications** (e.g. Slack/email) for deployment and error alerts.
- **Custom**: For API latency, use the `api_response` custom event in Vercel Analytics (Pro+) to build dashboards and thresholds, or forward the same events to a third-party APM (e.g. Datadog, Axiom) and define P95 alerts there.
- **Arbiscan**: Alerts at 80 / 90 / 95% of daily limit are logged (and optionally sent to Slack). See [ARBISCAN-USAGE.md](./ARBISCAN-USAGE.md).

## Adding API Response Tracking to Other Routes

In any API route:

```js
import { trackApiResponse } from '@/lib/analytics';

export async function GET(request) {
  const start = Date.now();
  // ... logic ...
  const status = 200; // or 403, 429, 500, etc.
  trackApiResponse('/api/your/route', Date.now() - start, status); // fire-and-forget
  return NextResponse.json(data, { status });
}
```

Call `trackApiResponse` before every `return` (including error paths) so all outcomes are measured.

## Client-Side Custom Events

In client components:

```js
import { track } from '@vercel/analytics';

track('button_click', { name: 'subscribe' });
```

Custom events may require Vercel Pro/Enterprise to view in the Analytics UI.
