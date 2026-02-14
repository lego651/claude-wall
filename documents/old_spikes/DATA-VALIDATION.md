# Data validation (Zod schemas)

**PROP-017:** API responses for the propfirms v2 API are validated with Zod before sending. Invalid payloads are logged and the route returns 500 with "Response validation failed".

## Schemas

**Module:** `lib/schemas/propfirms.js`

| Schema | Use |
|--------|-----|
| `FirmIdSchema` | Firm identifier (alphanumeric, hyphens, underscores) |
| `MetricsSchema` | totalPayouts, payoutCount, largestPayout, avgPayout, latestPayoutAt |
| `FirmSchema` | List item: id, name, logo, website, metrics |
| `PropfirmsListResponseSchema` | GET /api/v2/propfirms body: data[], meta |
| `PayoutSchema` | Single payout (latest-payouts: id, timestamp, amount, paymentMethod, txHash, arbiscanUrl) |
| `LatestPayoutsResponseSchema` | GET latest-payouts body: firmId, payouts[], count |
| `TopPayoutsResponseSchema` | GET top-payouts body: firmId, period, payouts[] (items may have date) |
| `ChartDataSchema` | GET chart body: firm, summary, chart{ period, bucketType, data[] } |

## Helpers

- **`parseOrLog(schema, data, context)`** – `schema.safeParse(data)`; on failure logs with `log.warn` and returns `{ success: false, data: null }`. On success returns `{ success: true, data }`.
- **`validatePropfirmsListResponse(body)`** – Returns validated list body or null.
- **`validateLatestPayoutsResponse(body)`** – Returns validated latest-payouts body or null.
- **`validateTopPayoutsResponse(body)`** – Returns validated top-payouts body or null.
- **`validateChartResponse(body)`** – Returns validated chart body or null.

## Where validation runs

- **GET /api/v2/propfirms** – Before `NextResponse.json(body)`; validates list response. On failure: 500, "Response validation failed".
- **GET /api/v2/propfirms/[id]/latest-payouts** – Validates response object; 500 on failure.
- **GET /api/v2/propfirms/[id]/chart** – Validates chart body; 500 on failure.
- **GET /api/v2/propfirms/[id]/top-payouts** – Validates top-payouts body; 500 on failure.

## Error handling

- Validation failure is logged with `context` and Zod `issues` (see `parseOrLog`).
- The route does not send the unvalidated body; it returns 500 so clients don’t receive malformed data.
- Supabase/JSON sources are not pre-validated before building the response; only the final response is validated. Adding input validation (e.g. for Supabase rows or file contents) can be done in a later pass.

## Tests

- **`lib/schemas/propfirms.test.js`** – Unit tests for each schema and validator (parse, reject invalid, parseOrLog, validate* helpers).
