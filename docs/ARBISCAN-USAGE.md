# Arbiscan usage tracking (PROP-019)

We track daily API call count to Arbiscan (Etherscan V2 API) to avoid hitting the daily limit (100,000 calls per API key).

## How it works

- **ArbiscanUsageTracker** (singleton in `lib/arbiscan.js`):
  - Counts each request made via `fetchWithRetry()` (each attempt, including retries).
  - Resets at **midnight UTC** (new day = new count).
  - **getUsage()** returns `{ calls, limit: 100000, percentage, day }`.

- **Alerts**:
  - At **80%**, **90%**, and **95%** we log a warning and, if **SLACK_WEBHOOK_URL** is set, post once per threshold per day to Slack.

- **Sync logging**: After each payout sync (`syncAllFirms`), we log current usage (calls, limit, percentage, day).

## Admin endpoint

- **GET /api/admin/arbiscan-usage**
  - Returns `{ calls, limit, percentage, day }`.
  - Requires an authenticated user with **is_admin** (Supabase `profiles.is_admin`).
  - Use from the admin dashboard or with a session cookie.

## Usage patterns

- **Payout sync** (cron or manual): For each firm we call `fetchNativeTransactions` and `fetchTokenTransactions` per address. So **2 × (number of addresses)** calls per firm per run. With many firms and multiple addresses each, a full sync can be hundreds of calls.
- **Historical sync** (e.g. update-monthly-json): Similar pattern; each firm/address pair = 2 calls.
- **Rate limits**: Arbiscan may return rate limit errors; we retry with backoff. Each attempt is counted, so a rate-limited run can add many “calls” to the counter even if some requests fail.

## Configuration

- **SLACK_WEBHOOK_URL** (optional): Incoming webhook URL for Slack. When set, we send one message per threshold (80, 90, 95) per day when usage crosses that threshold.

## Limits

- Etherscan/Arbiscan daily limit is **100,000** requests per API key (see their docs for current limits). We use this value as the default `limit` in the tracker.
