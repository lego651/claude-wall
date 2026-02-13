# PropFirms Production Readiness - Task Breakdown

**Generated**: 2026-02-13
**Target**: 90%+ test coverage, production-ready infrastructure
**Estimated Timeline**: 8 weeks (1 senior engineer + 1 mid-level engineer)

---

## Epic 1: Critical Production Blockers (Week 1-2)

### PROP-001: Set Up Test Framework ⚙️
**Priority**: P0 (Blocker)
**Estimate**: 1 day
**Assignee**: Senior Engineer

**Description**:
Configure Jest + React Testing Library for the entire codebase. No tests can be written until this is complete.

**Acceptance Criteria**:
- [x] Install Jest, @testing-library/react, @testing-library/jest-dom
- [x] Create `jest.config.js` with proper module mapping (`@/` aliases)
- [x] Add `jest.setup.js` for global test configuration
- [x] Configure coverage thresholds (90% for all metrics; currently 1% minimum, goal 90%)
- [x] Add npm scripts: `test`, `test:watch`, `test:coverage`
- [x] Verify sample test runs successfully
- [x] Document testing patterns in `/docs/TESTING.md`

**Dependencies**: None

**Files to Create**:
- `jest.config.js`
- `jest.setup.js`
- `__tests__/sample.test.js` (smoke test)
- `docs/TESTING.md`

---

### PROP-002: Implement Arbiscan Retry Logic with Exponential Backoff 🔄
**Priority**: P0 (Blocker)
**Estimate**: 2 days
**Assignee**: Senior Engineer

**Description**:
Current Arbiscan integration silently fails on errors. Add robust retry logic with exponential backoff to handle transient failures.

**Acceptance Criteria**:
- [x] Create `fetchWithRetry()` function with exponential backoff
  - Max 3 retries
  - Backoff: 1s, 2s, 4s (max 30s)
- [x] Handle specific error types:
  - Rate limit → retry with backoff
  - Invalid API key → throw immediately (no retry)
  - Network errors → retry
  - No data → return empty array (not an error)
- [x] Add timeout protection (10s per request)
- [x] Log retry attempts with context
- [x] Update `fetchNativeTransactions()` to use new logic
- [x] Update `fetchTokenTransactions()` to use new logic
- [x] Add unit tests (100% coverage)

**Dependencies**: PROP-001 (test framework)

**Files to Modify**:
- `lib/arbiscan.js`

**Files to Create**:
- `lib/arbiscan.test.js`

**Test Cases**:
```javascript
describe('fetchWithRetry', () => {
  it('succeeds on first try', async () => { ... });
  it('retries on rate limit error', async () => { ... });
  it('throws after max retries', async () => { ... });
  it('does not retry on invalid API key', async () => { ... });
  it('respects exponential backoff timing', async () => { ... });
});
```

---

### PROP-003: Add Circuit Breaker for Arbiscan API 🛡️
**Priority**: P0 (Blocker)
**Estimate**: 2 days
**Assignee**: Senior Engineer

**Description**:
Prevent cascading failures by stopping requests to Arbiscan when it's consistently failing.

**Acceptance Criteria**:
- [x] Create `ArbiscanCircuitBreaker` class
  - States: CLOSED (normal), OPEN (blocking), HALF_OPEN (testing)
  - Threshold: 5 consecutive failures
  - Timeout: 60 seconds before retry
- [x] Track failure/success counts
- [x] Expose `execute()` method to wrap API calls
- [x] Add logging when circuit opens/closes
- [x] Integrate with `fetchWithRetry()`
- [x] Add unit tests (100% coverage)
- [x] Document circuit breaker behavior

**Dependencies**: PROP-002 (retry logic)

**Files to Modify**:
- `lib/arbiscan.js`

**Files to Create**:
- `lib/arbiscan.test.js` (extend existing)

**Example Usage**:
```javascript
const circuitBreaker = new ArbiscanCircuitBreaker();

export async function fetchNativeTransactions(address, apiKey) {
  return circuitBreaker.execute(() => fetchWithRetry(...));
}
```

---

### PROP-004: Add Structured Logging with Context 📝
**Priority**: P0 (Blocker)
**Estimate**: 2 days
**Assignee**: Mid-level Engineer

**Description**:
Replace `console.log()` with structured logging to enable debugging in production.

**Acceptance Criteria**:
- [x] Install `pino` logger (`yarn add pino`)
- [x] Create `lib/logger.js` with configured pino instance
- [x] Define log levels: debug, info, warn, error
- [x] Add context fields: requestId, userId, firmId, timestamp
- [x] Replace all `console.log` in API routes with `logger.info`
- [x] Replace all `console.error` with `logger.error`
- [x] Add request ID middleware
- [x] Log all API calls (route, method, params, duration)
- [x] Log all errors (stack trace, context)
- [x] Configure JSON output for production
- [x] Add unit tests for logger configuration

**Dependencies**: None

**Files to Create**:
- `lib/logger.js`
- `lib/logger.test.js`
- `middleware/requestId.js`

**Files to Modify**:
- All API routes in `app/api/v2/propfirms/**/*.js`
- `lib/services/payoutSyncService.js`
- `lib/arbiscan.js`

**Example**:
```javascript
import { logger } from '@/lib/logger';

export async function GET(request) {
  const requestId = crypto.randomUUID();

  logger.info('API request', {
    requestId,
    route: '/api/v2/propfirms',
    params: { period, sort, order },
  });

  try {
    // ...
    logger.info('API response', { requestId, duration: Date.now() - start });
  } catch (error) {
    logger.error('API error', {
      requestId,
      error: error.message,
      stack: error.stack,
    });
  }
}
```

---

### PROP-005: Integrate Error Tracking (Sentry) 🚨
**Priority**: P0 (Blocker)
**Estimate**: 1 day
**Assignee**: Mid-level Engineer

**Description**:
Add Sentry for real-time error tracking and alerting.

**Acceptance Criteria**:
- [x] Create Sentry account (free tier) — user action
- [x] Install `@sentry/nextjs` (`yarn add @sentry/nextjs`)
- [x] Run `npx @sentry/wizard@latest -i nextjs` to configure — manual config added instead
- [x] Set `SENTRY_DSN` environment variable (see docs/SENTRY.md)
- [x] Configure error sampling (100% in prod; all errors sent when DSN set)
- [x] Add source maps for stack traces (via SENTRY_AUTH_TOKEN + org/project in build)
- [ ] Test error reporting (trigger sample error) — user verifies in Sentry
- [ ] Set up alerts for critical errors — user config in Sentry dashboard
- [x] Document Sentry dashboard usage (docs/SENTRY.md)
- [x] Add performance monitoring for API routes (tracesSampleRate in server/edge/client configs)

**Dependencies**: None

**Files to Create**:
- `sentry.client.config.js`
- `sentry.server.config.js`
- `sentry.edge.config.js`
- `docs/SENTRY.md`

**Environment Variables**:
```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx # For source maps upload
```

---

### PROP-006: Add File Size Monitoring & Alerts 📊
**Priority**: P0 (Blocker)
**Estimate**: 1 day
**Assignee**: Mid-level Engineer

**Description**:
Monitor JSON file sizes and alert when approaching timeout risk (>5MB).

**Acceptance Criteria**:
- [x] Create script: `scripts/check-file-sizes.js`
  - Scan `data/payouts/` directory
  - Report files >1MB, >5MB, >10MB
  - Calculate total size
  - Output JSON for monitoring
- [x] Add GitHub Actions workflow: `.github/workflows/monitor-file-sizes.yml`
  - Run daily (alongside historical sync)
  - Fail if any file >10MB
  - Warn if any file >5MB
  - Post to Slack if issues found
- [x] Add file size logging to API routes
  - Log when loading file >500KB
- [x] Create dashboard (simple markdown report)
- [x] Document mitigation steps

**Dependencies**: PROP-004 (logging)

**Files to Create**:
- `scripts/check-file-sizes.js`
- `.github/workflows/monitor-file-sizes.yml`
- `docs/FILE-SIZE-MITIGATION.md`

**Example Alert**:
```
⚠️  Large Files Detected:
  - data/payouts/fundingpips/2025-02.json: 7.2 MB
  - data/payouts/the5ers/2025-01.json: 6.1 MB

Action required: Consider migrating to Supabase storage
```

---

## Epic 2: Test Coverage - Unit Tests (Week 2-3)

### PROP-007: Unit Tests - API Security (`lib/apiSecurity.js`) 🧪
**Priority**: P0 (Blocker)
**Estimate**: 1 day
**Assignee**: Mid-level Engineer

**Description**:
Achieve 100% test coverage for API security functions.

**Acceptance Criteria**:
- [x] Test `validateOrigin()`:
  - ✅ Allows same-origin requests
  - ✅ Allows missing origin header (server-to-server)
  - ✅ Allows whitelisted origins
  - ✅ Blocks unknown origins
  - ✅ Returns correct CORS headers
- [x] Test `isRateLimited()`:
  - ✅ Allows first request from IP
  - ✅ Rate limits after threshold (60/min)
  - ✅ Resets after window expires
  - ✅ Handles missing IP gracefully
  - ✅ Returns correct retry-after time
- [x] Test `getClientIp()`:
  - ✅ Extracts IP from x-forwarded-for
  - ✅ Handles multiple IPs (takes first)
  - ✅ Fallback to "unknown" if missing
- [x] Coverage: 100%

**Dependencies**: PROP-001 (test framework)

**Files to Create**:
- `lib/apiSecurity.test.js`

**Test Count**: ~15 tests

---

### PROP-008: Unit Tests - Data Loader (`lib/services/payoutDataLoader.js`) 🧪
**Priority**: P0 (Blocker)
**Estimate**: 2 days
**Assignee**: Mid-level Engineer

**Description**:
Achieve 95%+ test coverage for file loading and data aggregation logic.

**Acceptance Criteria**:
- [x] Test `loadMonthlyData()`:
  - ✅ Loads existing file successfully
  - ✅ Returns null for missing file
  - ✅ Handles corrupted JSON gracefully
  - ✅ Logs errors appropriately
- [x] Test `getAvailableMonths()`:
  - ✅ Returns sorted months (newest first)
  - ✅ Filters non-JSON files
  - ✅ Returns empty array for missing dir
- [x] Test `loadPeriodData()`:
  - ✅ Filters to last 7 days correctly
  - ✅ Filters to last 30 days correctly
  - ✅ Aggregates 12 months correctly
  - ✅ Calculates summary metrics accurately
  - ✅ Handles missing files gracefully
  - ✅ Merges data from multiple months
- [x] Test `getTopPayoutsFromFiles()`:
  - ✅ Returns top N payouts sorted by amount
  - ✅ Filters by period (30d, 12m)
  - ✅ Handles empty data
- [x] Coverage: 95%

**Dependencies**: PROP-001 (test framework)

**Files to Create**:
- `lib/services/payoutDataLoader.test.js`
- `__mocks__/fs.js` (mock file system)
- `__fixtures__/sample-payout-data.json` (test data)

**Test Count**: ~20 tests

---

### PROP-009: Unit Tests - Arbiscan API (`lib/arbiscan.js`) 🧪
**Priority**: P1 (High)
**Estimate**: 2 days
**Assignee**: Mid-level Engineer

**Description**:
Test Arbiscan API integration with mocked responses.

**Acceptance Criteria**:
- [x] Test `fetchNativeTransactions()`:
  - ✅ Fetches transactions successfully
  - ✅ Returns empty array for "No transactions found"
  - ✅ Retries on rate limit
  - ✅ Throws on invalid API key
  - ✅ Respects timeout (via fetchWithRetry timeout test)
  - ✅ Circuit breaker opens after failures (via ArbiscanCircuitBreaker test)
- [x] Test `fetchTokenTransactions()`:
  - ✅ Same as above
- [x] Test `fetchWithRetry()`:
  - ✅ Succeeds on first try
  - ✅ Retries up to max attempts
  - ✅ Uses exponential backoff
  - ✅ Logs retry attempts
- [x] Test `ArbiscanCircuitBreaker`:
  - ✅ Starts in CLOSED state
  - ✅ Opens after threshold failures
  - ✅ Transitions to HALF_OPEN after timeout
  - ✅ Closes after successful request in HALF_OPEN
- [x] Coverage: 90%

**Dependencies**: PROP-002, PROP-003 (retry + circuit breaker)

**Files to Create**:
- `lib/arbiscan.test.js`

**Test Count**: ~18 tests

---

### PROP-010: Unit Tests - Payout Sync Service (`lib/services/payoutSyncService.js`) 🧪
**Priority**: P1 (High)
**Estimate**: 3 days
**Assignee**: Senior Engineer

**Description**:
Test the core sync logic with mocked Arbiscan and Supabase.

**Acceptance Criteria**:
- [x] Test `processPayouts()`:
  - ✅ Filters to 24h window correctly
  - ✅ Filters by firm addresses
  - ✅ Converts amounts to USD
  - ✅ Removes spam (<$10)
  - ✅ Deduplicates by tx_hash
  - ✅ Maps tokens to payment methods
- [x] Test `syncFirmPayouts()`:
  - ✅ Fetches transactions from all addresses
  - ✅ Respects rate limits (sleeps between calls)
  - ✅ Upserts to Supabase correctly
  - ✅ Updates firm metadata
  - ✅ Handles errors gracefully
  - ✅ Returns sync summary
- [x] Test `syncAllFirms()`:
  - ✅ Syncs all firms sequentially
  - ✅ Cleans up old payouts
  - ✅ Returns aggregate summary
  - ✅ Logs errors but continues
- [x] Test `cleanupOldPayouts()`:
  - ✅ Deletes payouts older than cutoff
  - ✅ Returns deletion count
- [x] Coverage: 85%

**Dependencies**: PROP-001 (test framework)

**Files to Create**:
- `lib/services/payoutSyncService.test.js`
- `__mocks__/@supabase/supabase-js.js`

**Test Count**: ~25 tests

---

## Epic 3: Test Coverage - Integration Tests (Week 3-4)

### PROP-011: Integration Tests - List Propfirms API (`/api/v2/propfirms`) 🧪
**Priority**: P0 (Blocker)
**Estimate**: 2 days
**Assignee**: Mid-level Engineer

**Description**:
Test the main propfirms listing endpoint with real database queries.

**Acceptance Criteria**:
- [x] Test successful responses:
  - ✅ Returns 200 for 1d period (Supabase)
  - ✅ Returns 200 for 7d, 30d, 12m (JSON files)
  - ✅ Returns correct data structure
  - ✅ Returns sorted data (asc/desc)
  - ✅ Returns metadata (period, sort, order, count)
- [x] Test error handling:
  - ✅ Returns 429 when rate limited
  - ✅ Returns 403 for forbidden origin
  - ✅ Returns 500 on database error (with fallback)
- [x] Test parameter validation:
  - ✅ Defaults to 1d period for invalid input
  - ✅ Defaults to totalPayouts sort for invalid input
  - ✅ Defaults to desc order for invalid input
- [x] Test CORS headers:
  - ✅ Sets Access-Control-Allow-Origin
  - ✅ Sets Access-Control-Allow-Methods
- [x] Coverage: 85%

**Dependencies**: PROP-001 (test framework)

**Files to Create**:
- `app/api/v2/propfirms/route.test.js`

**Test Count**: ~15 tests

---

### PROP-012: Integration Tests - Firm Detail APIs 🧪
**Priority**: P1 (High)
**Estimate**: 3 days
**Assignee**: Mid-level Engineer

**Description**:
Test all firm detail endpoints: chart, latest-payouts, top-payouts, signals, incidents.

**Acceptance Criteria**:

**Chart API** (`/api/v2/propfirms/[id]/chart`):
- [x] ✅ Returns 200 for valid firm
- [x] ✅ Returns 404 for non-existent firm
- [x] ✅ Returns daily buckets for 30d period
- [x] ✅ Returns monthly buckets for 12m period
- [x] ✅ Fills gaps with zero values
- [x] ✅ Returns summary metrics

**Latest Payouts API** (`/api/v2/propfirms/[id]/latest-payouts`):
- [x] ✅ Returns payouts from last 24h
- [x] ✅ Returns empty array if no payouts
- [x] ✅ Returns 404 for non-existent firm
- [x] ✅ Includes Arbiscan URLs

**Top Payouts API** (`/api/v2/propfirms/[id]/top-payouts`):
- [x] ✅ Returns top 10 payouts for 30d
- [x] ✅ Returns top 10 payouts for 12m
- [x] ✅ Filters to Rise payments only
- [x] ✅ Sorted by amount (descending)

**Signals API** (`/api/v2/propfirms/[id]/signals`):
- [x] ✅ Returns payout summary
- [x] ✅ Returns Trustpilot sentiment
- [x] ✅ Filters reviews by date range

**Incidents API** (`/api/v2/propfirms/[id]/incidents`):
- [x] ✅ Returns incidents from last N days
- [x] ✅ Includes source links (Trustpilot URLs)
- [x] ✅ Sorted by week (newest first)

**Coverage**: 85% for all endpoints

**Dependencies**: PROP-001 (test framework)

**Files to Create**:
- `app/api/v2/propfirms/[id]/chart/route.test.js`
- `app/api/v2/propfirms/[id]/latest-payouts/route.test.js`
- `app/api/v2/propfirms/[id]/top-payouts/route.test.js`
- `app/api/v2/propfirms/[id]/signals/route.test.js`
- `app/api/v2/propfirms/[id]/incidents/route.test.js`

**Test Count**: ~30 tests

---

## Epic 4: Infrastructure & Performance (Week 4-5)

### PROP-013: Implement Response Caching (Vercel KV) 🗄️
**Priority**: P1 (High)
**Estimate**: 3 days
**Assignee**: Senior Engineer

**Description**:
Add Redis-based caching to reduce file I/O and database queries.

**Acceptance Criteria**:
- [x] Install Vercel KV (`yarn add @vercel/kv`)
- [x] Configure `KV_REST_API_URL` and `KV_REST_API_TOKEN`
- [x] Create `lib/cache.js` helper:
  - `get(key)` - Retrieve from cache
  - `set(key, value, ttl)` - Store with expiration
  - `invalidate(pattern)` - Clear by pattern
- [x] Cache API responses:
  - `/api/v2/propfirms?period=*` → 5 min TTL
  - `/api/v2/propfirms/[id]/chart?period=*` → 10 min TTL
  - `/api/v2/propfirms/[id]/top-payouts` → 30 min TTL
- [x] Cache file reads:
  - `loadMonthlyData()` results → 5 min TTL
- [x] Add cache hit/miss logging
- [x] Add unit tests
- [x] Document caching strategy

**Dependencies**: None

**Files to Create**:
- `lib/cache.js`
- `lib/cache.test.js`

**Files to Modify**:
- All API routes in `app/api/v2/propfirms/**/*.js`
- `lib/services/payoutDataLoader.js`

**Example**:
```javascript
import { cache } from '@/lib/cache';

export async function GET(request) {
  const cacheKey = `propfirms:${period}:${sort}:${order}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Compute data
  const data = await fetchData(...);

  // Store in cache
  await cache.set(cacheKey, data, 300); // 5 min TTL

  return NextResponse.json(data);
}
```

**Cost**: Vercel KV free tier = 256 MB, 3k commands/day (sufficient)

---

### PROP-014: Add Database Indexes 🗂️
**Priority**: P1 (High)
**Estimate**: 1 day
**Assignee**: Senior Engineer

**Description**:
Optimize Supabase queries with missing indexes.

**Acceptance Criteria**:
- [ ] Audit current indexes (check Supabase dashboard)
- [x] Create migration file: `supabase/migrations/002_add_indexes.sql`
- [x] Add indexes:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_recent_payouts_firm_timestamp
    ON recent_payouts(firm_id, timestamp DESC);

  CREATE INDEX IF NOT EXISTS idx_recent_payouts_timestamp
    ON recent_payouts(timestamp DESC);

  CREATE INDEX IF NOT EXISTS idx_trustpilot_firm_date
    ON trustpilot_reviews(firm_id, review_date DESC);

  CREATE INDEX IF NOT EXISTS idx_weekly_incidents_firm_year_week
    ON weekly_incidents(firm_id, year DESC, week_number DESC);
  ```
- [ ] Run migration in staging
- [ ] Benchmark query performance (before/after)
- [x] Document expected speedups (`docs/DATABASE-OPTIMIZATION.md`)
- [ ] Deploy to production

**Dependencies**: None

**Files to Create**:
- `supabase/migrations/002_add_indexes.sql`
- `docs/DATABASE-OPTIMIZATION.md`

**Expected Speedup**:
- `recent_payouts` query: 500ms → 50ms (10x)
- `trustpilot_reviews` query: 200ms → 30ms (6x)

---

### PROP-015: Optimize File I/O with Async Loading 📂
**Priority**: P1 (High)
**Estimate**: 2 days
**Assignee**: Senior Engineer

**Description**:
Replace blocking file reads with async I/O to improve concurrency.

**Acceptance Criteria**:
- [x] Convert `loadMonthlyData()` to async (uses `fs.promises.readFile`, `fs.promises.stat`, `fs.promises.access`)
- [x] Update `loadPeriodData()` to be async
- [x] Update `getTopPayoutsFromFiles()` to be async
- [x] Update all API routes to `await` file loads
- [x] Add error handling for file errors (try/catch, log, return null)
- [ ] Benchmark performance improvement (user/load test)
- [x] Update tests to handle async
- [x] Document async patterns (`docs/ASYNC-FILE-IO.md`)

**Dependencies**: None

**Files to Modify**:
- `lib/services/payoutDataLoader.js`
- All API routes using `loadMonthlyData()`

**Expected Improvement**:
- Concurrent requests no longer block each other
- Same throughput, better latency under load

---

### PROP-016: Add Supabase Connection Pooling & Timeout Protection 🔌
**Priority**: P1 (High)
**Estimate**: 1 day
**Assignee**: Senior Engineer

**Description**:
Prevent database connection exhaustion and slow queries.

**Acceptance Criteria**:
- [x] Connection pooling: Handled by Supabase (Supavisor); JS client uses REST, no client-side pool config (see docs/SUPABASE-TIMEOUT.md).
- [x] Add query timeout wrapper: `lib/supabaseQuery.js` – `withQueryGuard()`, `queryWithTimeout()` (5s default).
- [x] Apply timeout to Supabase queries (v2 propfirms API routes + payoutSyncService).
- [x] Log slow queries (>1s) via `withQueryGuard` slowThresholdMs.
- [x] Add fallback for timeout errors (500 / "Database timeout" in API; sync continues with error per firm).
- [ ] Update tests (optional: add timeout-path test).
- [x] Document timeout strategy (`docs/SUPABASE-TIMEOUT.md`)

**Dependencies**: PROP-004 (logging)

**Files to Modify**:
- `lib/supabase/server.js` (create if not exists)
- All API routes using Supabase
- `lib/services/payoutSyncService.js`

---

## Epic 5: Data Validation & Reliability (Week 5-6)

### PROP-017: Add Data Validation with Zod Schemas 🛡️
**Priority**: P1 (High)
**Estimate**: 2 days
**Assignee**: Mid-level Engineer

**Description**:
Validate all API responses to catch data corruption early.

**Acceptance Criteria**:
- [x] Install Zod (`yarn add zod`)
- [x] Create schemas in `lib/schemas/propfirms.js`:
  - `FirmSchema`, `FirmIdSchema`, `MetricsSchema`
  - `PayoutSchema`, `TopPayoutsResponseSchema` (top-payout item has date)
  - `PropfirmsListResponseSchema`, `LatestPayoutsResponseSchema`, `ChartDataSchema`
- [ ] Validate Supabase query results (optional; response validation covers output)
- [ ] Validate JSON file contents (optional)
- [x] Validate API responses before sending (list, latest-payouts, chart, top-payouts)
- [x] Add error logging for validation failures (`parseOrLog` → log.warn)
- [x] Add unit tests for schemas (`lib/schemas/propfirms.test.js`)
- [x] Document validation approach (`docs/DATA-VALIDATION.md`)

**Dependencies**: PROP-004 (logging)

**Files to Create**:
- `lib/schemas/propfirms.js`
- `lib/schemas/propfirms.test.js`

**Files to Modify**:
- All API routes (add validation before `NextResponse.json()`)

**Example**:
```javascript
import { z } from 'zod';

const FirmSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  metrics: z.object({
    totalPayouts: z.number().nonnegative(),
    payoutCount: z.number().int().nonnegative(),
    largestPayout: z.number().nonnegative(),
    avgPayout: z.number().nonnegative(),
  }),
});

// In API route
const validated = data.map(firm => FirmSchema.parse(firm));
return NextResponse.json({ data: validated });
```

---

### PROP-018: Implement Data Overlap Detection 🔍
**Priority**: P2 (Medium)
**Estimate**: 2 days
**Assignee**: Senior Engineer

**Description**:
Validate that real-time (Supabase) and historical (JSON) data are consistent.

**Acceptance Criteria**:
- [x] Create validation function: `validateMonthData(firmId, yearMonth)` in `lib/services/dataOverlapValidation.js`
  - Query Supabase `recent_payouts` for firm + month range
  - Compare transaction hashes with JSON `loadMonthlyData()`
  - Return summary (jsonCount, supabaseCount, missingInJson, missingInSupabase, matchRate)
- [x] Add script and workflow: `scripts/validate-data-overlap.js`, `.github/workflows/validate-data.yml`
  - Run on schedule (11:45 UTC) and workflow_dispatch
  - Fail workflow if >5% of Supabase rows missing from JSON (per firm/month)
  - Log detailed diff (missing tx hashes + amounts)
- [x] Simple report: script stdout (per firm/month ✅/⚠️ and missing list)
- [x] Alerting: workflow failure is the alert; optional Slack in workflow
- [x] Document resolution steps (`docs/DATA-OVERLAP-RESOLUTION.md`)

**Dependencies**: PROP-004 (logging)

**Files to Create**:
- `scripts/validate-data-overlap.js`
- `.github/workflows/validate-data.yml`
- `docs/DATA-OVERLAP-RESOLUTION.md`

**Example Output**:
```
✅ aquafunded 2025-02: 45 transactions match
⚠️  fundingpips 2025-02: 3 transactions missing from JSON
  - 0xabc123... ($1,500)
  - 0xdef456... ($2,000)
  - 0xghi789... ($1,200)
```

---

### PROP-019: Add Arbiscan Usage Tracking 📈
**Priority**: P2 (Medium)
**Estimate**: 1 day
**Assignee**: Mid-level Engineer

**Description**:
Track Arbiscan API usage to prevent hitting daily limits.

**Acceptance Criteria**:
- [x] Create `ArbiscanUsageTracker` class in `lib/arbiscan.js`:
  - Track daily call count, reset at midnight UTC
  - Alert at 80%, 90%, 95% (log.warn + optional Slack)
  - `getUsage()` returns { calls, limit: 100000, percentage, day }
- [x] Integrate with `fetchWithRetry()` (trackCall() each attempt)
- [x] Log usage stats on every sync (syncAllFirms logs arbiscan usage)
- [x] Add monitoring endpoint: `GET /api/admin/arbiscan-usage`
  - Returns { calls, limit, percentage, day }; requires auth + is_admin
- [x] Add Slack alert at 80%, 90%, 95% (when SLACK_WEBHOOK_URL set; once per threshold per day)
- [x] Document usage patterns (`docs/ARBISCAN-USAGE.md`)

**Dependencies**: PROP-004 (logging)

**Files to Modify**:
- `lib/arbiscan.js`

**Files to Create**:
- `app/api/admin/arbiscan-usage/route.js`

**Example**:
```javascript
const tracker = new ArbiscanUsageTracker();

export async function fetchNativeTransactions(address, apiKey) {
  const usage = tracker.trackCall();

  if (usage.percentage >= 80) {
    logger.warn('High Arbiscan usage', usage);
  }

  return fetchWithRetry(...);
}
```

---

## Epic 6: Monitoring & Observability (Week 6-7)

### PROP-020: Set Up APM Monitoring (Vercel Analytics) 📊
**Priority**: P1 (High)
**Estimate**: 1 day
**Assignee**: Mid-level Engineer

**Description**:
Enable application performance monitoring to track API latencies.

**Acceptance Criteria**:
- [ ] Enable Vercel Analytics in dashboard (manual in Vercel project settings)
- [x] Install `@vercel/analytics` package
- [x] Add Analytics component to root layout
- [x] Configure custom events:
  - Track API response times by route (`trackApiResponse` in `lib/analytics.js`, wired in `/api/v2/propfirms`)
  - Track Arbiscan API calls (`trackArbiscanCall` helper; optional wire-in)
  - Track file I/O durations (optional; doc in MONITORING.md)
  - Track cache hit/miss rates (`trackCacheResult` helper; optional wire-in)
- [x] Set up performance budgets (documented in MONITORING.md):
  - P95 latency <500ms for 1d period
  - P95 latency <2s for 12m period
- [x] Create alerts for SLA violations (documented: Vercel notifications, third-party APM)
- [x] Document metrics (`docs/MONITORING.md`)

**Dependencies**: None

**Files to Modify**:
- `app/layout.js`

**Files to Create**:
- `lib/analytics.js`
- `docs/MONITORING.md`

**Cost**: Free on Vercel Hobby plan (basic metrics)

---

### PROP-021: Create Monitoring Dashboard (Grafana/Simple UI) 📉
**Priority**: P2 (Medium)
**Estimate**: 3 days
**Assignee**: Senior Engineer

**Description**:
Build a dashboard to visualize system health metrics.

**Acceptance Criteria**:
- [ ] Create admin page: `/admin/dashboard`
  - Require authentication
  - Display key metrics:
    - API response times (P50, P95, P99)
    - Arbiscan API usage (calls/day, % of limit)
    - File sizes (largest files, total size)
    - Database stats (row counts, storage usage)
    - Cache hit rates
    - Error rates by endpoint
  - Auto-refresh every 30s
- [ ] Add API endpoint: `/api/admin/metrics`
  - Return JSON with all metrics
- [ ] Style with Tailwind + DaisyUI
- [ ] Add export to CSV
- [ ] Document dashboard usage

**Dependencies**: PROP-019 (usage tracking), PROP-020 (APM)

**Files to Create**:
- `app/admin/dashboard/page.js`
- `app/api/admin/metrics/route.js`
- `docs/ADMIN-DASHBOARD.md`

---

### PROP-022: Set Up Alerting (PagerDuty/Slack) 🚨
**Priority**: P1 (High)
**Estimate**: 2 days
**Assignee**: Mid-level Engineer

**Description**:
Configure alerts for critical failures.

**Acceptance Criteria**:
- [ ] Create Slack webhook for alerts channel
- [ ] Create `lib/alerts.js` helper:
  - `sendAlert(service, message, severity)` → posts to Slack
  - Severity levels: INFO, WARNING, CRITICAL
  - Include context (timestamp, service, error details)
- [ ] Add alerts for:
  - Arbiscan API failures (>3 consecutive)
  - Supabase connection failures
  - File size >5MB
  - Sync failures (GitHub Actions)
  - Data overlap issues (>5% mismatch)
  - Rate limit exceeded (>90%)
  - API error rate >5%
- [ ] Test alert delivery
- [ ] Document alert runbooks

**Dependencies**: PROP-004 (logging)

**Files to Create**:
- `lib/alerts.js`
- `lib/alerts.test.js`
- `docs/RUNBOOKS.md`

**Environment Variables**:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

**Example**:
```javascript
import { sendAlert } from '@/lib/alerts';

if (circuitBreaker.state === 'OPEN') {
  await sendAlert(
    'Arbiscan API',
    'Circuit breaker opened - too many failures',
    'CRITICAL'
  );
}
```

---

## Epic 7: End-to-End Tests (Week 7)

### PROP-023: E2E Tests - Propfirms Leaderboard 🎭
**Priority**: P2 (Medium)
**Estimate**: 3 days
**Assignee**: Mid-level Engineer

**Description**:
Test full user flows with Playwright.

**Acceptance Criteria**:
- [ ] Install Playwright (`yarn add -D @playwright/test`)
- [ ] Configure Playwright (`playwright.config.js`)
- [ ] Create test suite: `tests/e2e/propfirms.spec.js`
  - ✅ Page loads and displays firms
  - ✅ Can switch between periods (1d, 7d, 30d, 12m)
  - ✅ Can sort by column (click header)
  - ✅ Can click firm to view details
  - ✅ Loading states work correctly
  - ✅ Error states display properly
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Test accessibility (ARIA labels, keyboard nav)
- [ ] Add visual regression tests (screenshots)
- [ ] Run tests in CI/CD pipeline
- [ ] Document E2E testing approach

**Dependencies**: PROP-001 (test framework)

**Files to Create**:
- `playwright.config.js`
- `tests/e2e/propfirms.spec.js`
- `tests/e2e/fixtures/setup.js`
- `.github/workflows/e2e-tests.yml`

**Test Count**: ~10 tests

**Coverage**: Critical user flows → 90%

---

## Epic 8: Documentation & Deployment (Week 8)

### PROP-024: Write Production Runbooks 📖
**Priority**: P1 (High)
**Estimate**: 2 days
**Assignee**: Senior Engineer

**Description**:
Document operational procedures for production incidents.

**Acceptance Criteria**:
- [ ] Create `docs/RUNBOOKS.md` with sections:
  - **Arbiscan API Down**: Symptoms, diagnosis, mitigation
  - **Supabase Outage**: Fallback procedures, manual recovery
  - **File Size Exceeded**: How to migrate to Supabase storage
  - **Data Overlap Issues**: How to reconcile mismatches
  - **Rate Limit Exceeded**: How to upgrade or reduce frequency
  - **Sync Failures**: How to manually trigger syncs
  - **Database Performance**: Query optimization steps
- [ ] Create incident response flowchart
- [ ] Document escalation paths
- [ ] Add contact information
- [ ] Review with team

**Dependencies**: None

**Files to Create**:
- `docs/RUNBOOKS.md`
- `docs/INCIDENT-RESPONSE.md`

---

### PROP-025: Performance Load Testing 🚀
**Priority**: P2 (Medium)
**Estimate**: 2 days
**Assignee**: Senior Engineer

**Description**:
Validate system performance under concurrent load.

**Acceptance Criteria**:
- [ ] Install k6 load testing tool
- [ ] Create load test scripts:
  - `tests/load/propfirms-list.js` (test `/api/v2/propfirms`)
  - `tests/load/firm-detail.js` (test detail endpoints)
- [ ] Test scenarios:
  - 10 concurrent users (baseline)
  - 50 concurrent users (expected peak)
  - 100 concurrent users (stress test)
- [ ] Measure:
  - Response time (P50, P95, P99)
  - Error rate
  - Throughput (requests/sec)
- [ ] Identify bottlenecks
- [ ] Document performance baselines
- [ ] Create scaling plan

**Dependencies**: PROP-013 (caching), PROP-014 (indexes)

**Files to Create**:
- `tests/load/propfirms-list.js`
- `tests/load/firm-detail.js`
- `docs/PERFORMANCE-BASELINES.md`

**Example Test**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50, // 50 virtual users
  duration: '5m',
};

export default function () {
  const res = http.get('https://example.com/api/v2/propfirms?period=1d');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

---

### PROP-026: Production Deployment Checklist ✅
**Priority**: P0 (Blocker)
**Estimate**: 1 day
**Assignee**: Senior Engineer

**Description**:
Create and execute pre-deployment checklist.

**Acceptance Criteria**:
- [ ] **Environment Variables**:
  - [ ] ARBISCAN_API_KEY set in Vercel
  - [ ] SUPABASE_URL and SUPABASE_ANON_KEY set
  - [ ] SUPABASE_SERVICE_ROLE_KEY set
  - [ ] SENTRY_DSN set
  - [ ] SLACK_WEBHOOK_URL set
  - [ ] KV_REST_API_URL and KV_REST_API_TOKEN set
- [ ] **Database**:
  - [ ] Indexes created (migration 002)
  - [ ] RLS policies configured
  - [ ] Backup enabled
- [ ] **Tests**:
  - [ ] All tests passing (unit + integration + E2E)
  - [ ] Coverage ≥90%
- [ ] **Monitoring**:
  - [ ] Sentry integrated
  - [ ] Vercel Analytics enabled
  - [ ] Slack alerts configured
- [ ] **Performance**:
  - [ ] Caching enabled (Vercel KV)
  - [ ] Load tests passing (P95 <500ms)
- [ ] **Documentation**:
  - [ ] README updated
  - [ ] RUNBOOKS complete
  - [ ] API docs updated
- [ ] **Deploy**:
  - [ ] Staging deployment successful
  - [ ] Smoke tests pass on staging
  - [ ] Production deployment
  - [ ] Post-deploy verification

**Dependencies**: All previous tickets

**Files to Create**:
- `docs/DEPLOYMENT.md`
- `docs/POST-DEPLOY-VERIFICATION.md`

---

## Summary

**Total Tickets**: 26
**Total Estimate**: 8 weeks (with 2 engineers)
**Critical Path**: PROP-001 → PROP-007 → PROP-011 → PROP-023 → PROP-026

**Priority Breakdown**:
- **P0 (Blockers)**: 9 tickets (~3 weeks)
- **P1 (High)**: 12 tickets (~4 weeks)
- **P2 (Medium)**: 5 tickets (~1 week)

**Coverage Targets**:
- Unit tests: 60% of test suite, 95%+ coverage
- Integration tests: 30% of test suite, 85%+ coverage
- E2E tests: 10% of test suite, 90% of critical flows

**Recommended Staffing**:
- **Senior Engineer** (40h/week × 8 weeks):
  - Lead architecture decisions
  - Handle complex tasks (sync service, circuit breaker, performance)
  - Review all PRs
  - Own production deployment

- **Mid-level Engineer** (40h/week × 8 weeks):
  - Write tests (unit + integration + E2E)
  - Implement monitoring/logging
  - Create dashboards
  - Write documentation

**Risks**:
1. **Scope creep**: Strict adherence to acceptance criteria required
2. **Test complexity**: May need more time for edge cases
3. **Performance issues**: Load testing may reveal unexpected bottlenecks
4. **Third-party dependencies**: Arbiscan API changes could impact timeline

**Success Criteria**:
- ✅ 90%+ test coverage
- ✅ All P0 tickets complete
- ✅ Production deployment successful
- ✅ No critical bugs in first 30 days
- ✅ P95 latency <500ms for 1d period
- ✅ Zero data loss or corruption incidents
