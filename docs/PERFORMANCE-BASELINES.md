# Performance baselines and load testing (PROP-025)

Load tests use **k6** to validate API performance under concurrent load.

## Install k6

k6 is a standalone binary (not an npm package):

- **macOS:** `brew install k6`
- **Linux:** [Install instructions](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- **Windows:** `choco install k6` or download from [k6.io](https://k6.io/)

Verify: `k6 version`

## Run load tests

**Base URL** defaults to `http://localhost:3000`. Override with `BASE_URL` for staging/production.

### Propfirms list (`/api/v2/propfirms`)

```bash
# Default: 10 VUs, 1 min
k6 run tests/load/propfirms-list.js

# 50 VUs, 2 min (expected peak)
VUS=50 DURATION=2m k6 run tests/load/propfirms-list.js

# 100 VUs, 2 min (stress)
VUS=100 DURATION=2m k6 run tests/load/propfirms-list.js

# Against production
BASE_URL=https://your-app.vercel.app VUS=50 DURATION=1m k6 run tests/load/propfirms-list.js
```

### Firm detail endpoints

```bash
# Default: 10 VUs, 1 min, firm fundingpips
k6 run tests/load/firm-detail.js

# 50 VUs, different firm
VUS=50 FIRM_ID=instantfunding k6 run tests/load/firm-detail.js
```

## Scenarios (acceptance criteria)

| Scenario   | VUs | Duration | Purpose        |
|-----------|-----|----------|----------------|
| Baseline  | 10  | 1–2 min  | Sanity check   |
| Peak      | 50  | 2 min    | Expected load  |
| Stress    | 100 | 2 min    | Find limits    |

Run each scenario and record results (see below).

## What we measure

- **Response time:** P50, P95, P99 (k6 prints these in the summary).
- **Error rate:** `http_req_failed` (target &lt; 5%).
- **Throughput:** Requests per second (k6 summary: `http_reqs` / duration).

### Thresholds (in scripts)

- **propfirms-list:** P95 &lt; 2s, P99 &lt; 5s, failure rate &lt; 5%.
- **firm-detail:** P95 &lt; 3s, P99 &lt; 6s, failure rate &lt; 5%.

If thresholds fail, the k6 run exits non-zero.

## Target SLAs (from MONITORING.md)

- **1d period (Supabase):** P95 &lt; 500 ms.
- **12m period (file):** P95 &lt; 2 s.

Load tests may run against cold caches; warm runs (after a few requests) better reflect production with cache.

## Identifying bottlenecks

1. Run with increasing VUs (10 → 50 → 100). Note where P95 or error rate spikes.
2. Compare **propfirms-list** (cached after first request) vs **firm-detail** (multiple endpoints). If one endpoint dominates latency, focus optimization there.
3. Check Vercel/server logs for timeouts (e.g. Supabase 5s, Vercel 10s).
4. If DB timeouts appear, confirm indexes (see [DATABASE-OPTIMIZATION.md](./DATABASE-OPTIMIZATION.md)) and consider increasing cache TTL or scaling DB.

## Scaling plan

| Observation              | Action |
|--------------------------|--------|
| P95 &lt; 500 ms at 50 VUs | Current setup sufficient for expected peak. |
| P95 &gt; 2s at 50 VUs    | Enable/verify caching (Vercel KV); add DB indexes; consider moving heavy reads to edge or background. |
| Error rate &gt; 5% at 100 VUs | Scale: more serverless instances (Vercel), or rate-limit and queue. |
| Timeouts (5s Supabase)   | Optimize slow queries; add indexes; or increase timeout only after query optimization. |

## Example summary output

After a run, k6 prints something like:

```
  http_req_duration..............: avg=120ms  min=45ms  med=110ms  max=890ms  p(95)=280ms
  http_req_failed................: 0.00%
  http_reqs.....................: 1200
  iterations....................: 600
  vus............................: 10
```

Record these in a spreadsheet or CI artifact when running baseline / peak / stress so you can track regressions.
