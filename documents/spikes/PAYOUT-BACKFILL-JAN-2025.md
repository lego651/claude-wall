# Backfill Prop Firm Payouts to January 2025

## Problem

The **Total Payouts** chart (e.g. `/propfirms/fundingpips/payouts`) shows last 12 months from JSON files in `data/propfirms/{firmId}/{YYYY-MM}.json`. For high-volume firms like FundingPips, data only starts around **August 2025** because:

1. **Arbiscan API limit**: The Etherscan/Arbiscan API returns at most **10,000 transactions** per request for `txlist` and `tokentx`.
2. **No pagination**: `lib/arbiscan.js` calls the API once per address with no `page` or `offset`, so we only ever get the latest 10k transactions.
3. **Result**: For firms with >10k total transactions, we never see older history (Jan 2025–Jul 2025).

The chart and `loadPeriodData(firmId, '12m')` in `lib/services/payoutDataLoader.js` read these monthly files; missing months show as zero in the chart.

## Current Data State (from repo)

| Firm               | Oldest month in `data/propfirms/` |
|--------------------|-----------------------------------|
| fundingpips        | 2025-08 (missing Jan–Jul 2025)    |
| the5ers            | 2025-07                           |
| alphacapitalgroup  | 2025-04                           |
| fxify, aquafunded, blueguardian, instantfunding | 2025-01 or 2025-02 |
| fundednext         | 2025-12                           |

**Goal**: Ensure every firm has monthly files from **2025-01** through the current month so the “last 12 months” view is complete.

---

## Plan

### 1. Add pagination to Arbiscan client

**File**: `lib/arbiscan.js`

- **Option A (recommended)**: Add optional `page` and `offset` to `fetchNativeTransactions` and `fetchTokenTransactions`, then add **fetch-all** helpers that loop until they get fewer than 10k results (or hit a cutoff timestamp for backfill).
- **Option B**: Use `startblock` / `endblock` with block numbers to request one month at a time (requires mapping month → Arbitrum block range; more precise but more setup).

Etherscan supports `page` and `offset` (max 10000 per page). Example:

- `page=1&offset=10000` → latest 10k txs  
- `page=2&offset=10000` → next 10k  
- Stop when `result.length < 10000` or when oldest tx is before `2025-01-01` (for backfill).

**Deliverable**: New exports, e.g. `fetchAllNativeTransactions(address, apiKey, { cutoffTimestamp })` and `fetchAllTokenTransactions(address, apiKey, { cutoffTimestamp })` that paginate and return all txs down to the cutoff (or all if no cutoff). Existing `fetchNativeTransactions` / `fetchTokenTransactions` stay as-is for real-time sync (they keep returning “latest page” only).

### 2. One-time backfill script

**Location**: `scripts/backfill-firm-payouts-to-jan2025.js` (or similar)

**Logic**:

1. Load firm list from `data/propfirms.json` (or from Supabase `firms` if that is the source of truth for the historical sync).
2. For each firm, determine **missing months** from 2025-01 up to (but not including) the oldest existing month in `data/propfirms/{firmId}/`.
3. For each (firm, month):
   - Fetch **all** transactions for the firm’s addresses using the new fetch-all API (with `cutoffTimestamp` at end of previous month so we don’t over-fetch).
   - Filter to that month (by firm timezone) and build the same structure as existing files: `summary`, `dailyBuckets`, `transactions`.
   - Write `data/propfirms/{firmId}/{YYYY-MM}.json`.
4. Respect rate limits: e.g. 5 calls/sec, and daily cap (100k/day); add delay between addresses/firms if needed.
5. Idempotent: skip months that already have a file (or support `--overwrite` for re-runs).

**Output**: New or updated JSON files under `data/propfirms/`. Commit and push (or run in CI with commit step similar to `sync-firm-payouts-historical.yml`).

### 3. Historical sync (no change)

The daily job only updates the **current month**; it runs once a day and is fine as-is. The backfill is a **one-time** fill of missing past months. No change to the historical sync script is required.


### 4. Run the backfill

- **Locally**: `ARBISCAN_API_KEY=... node scripts/backfill-firm-payouts-to-jan2025.js`  
  (Optionally `--firm fundingpips` to run for one firm only.)
- **CI**: Add a one-off or manual-dispatch job that runs the script and commits `data/propfirms/`, or run locally and push.

After the backfill, the 12-month chart for each firm will have data from Jan 2025 onward (subject to chain data and firm existence).

---

## Implementation order

1. **Implement pagination and fetch-all in `lib/arbiscan.js`** (no change to existing callers).
2. **Add backfill script** that uses the new fetch-all and writes monthly JSON in the existing format.
3. **Run backfill** for all firms (or per-firm), then commit.
4. **Run backfill** per firm (e.g. `--firm fundingpips` first), then all firms, then commit `data/propfirms/`.

---

## Monthly JSON format (reference)

Same structure as existing files (see `data/propfirms/fundingpips/2025-08.json` and `payoutDataLoader.js`):

```json
{
  "firmId": "fundingpips",
  "period": "2025-01",
  "timezone": "UTC",
  "generatedAt": "2026-02-14T12:00:00.000Z",
  "summary": {
    "totalPayouts": 1234567,
    "payoutCount": 542,
    "largestPayout": 25000,
    "avgPayout": 2276
  },
  "dailyBuckets": [
    { "date": "2025-01-01", "total": 45000, "rise": 30000, "crypto": 15000, "wire": 0 },
    ...
  ],
  "transactions": [
    {
      "tx_hash": "0x...",
      "firm_id": "fundingpips",
      "amount": 1500,
      "payment_method": "rise",
      "timestamp": "2025-01-01T14:23:45.000Z",
      "from_address": "0x...",
      "to_address": "0x..."
    },
    ...
  ]
}
```

Payout processing rules (from `payoutSyncService.js`): filter outgoing from firm addresses, map tokens (RISEPAY→rise, USDC/USDT→crypto), minimum $10, dedupe by `tx_hash`. Use same `PRICES` and `TOKEN_TO_METHOD` for consistency.

---

## Risks and mitigations

| Risk | Mitigation |
|------|-------------|
| Arbiscan rate limit / daily cap | Throttle (e.g. 500ms between pages/addresses), run backfill in off-peak or split over days. |
| Very large payloads | Process in chunks; backfill writes one month per file. |
| Script overwrites good data | Backfill only writes **missing** months; optional `--overwrite` for explicit re-runs. |
| Firm timezone | Use firm’s `timezone` from `propfirms.json` when mapping tx timestamps to calendar month (same as existing sync). |

---

## Summary

- **Root cause**: Arbiscan returns max 10k txs per request and we don’t paginate, so high-volume firms have no data before ~Aug 2025.
- **Fix**: Add paginated/fetch-all calls in `lib/arbiscan.js`, then a one-time backfill script that writes `data/propfirms/{firmId}/{YYYY-MM}.json` for missing months from Jan 2025.
- **Historical sync**: No change; daily job only updates current month. Backfill is one-time only.

---

## Implementation status

- [x] **Plan document** (this file).
- [x] **`lib/arbiscan.js`**: Optional `page`/`offset` on `fetchNativeTransactions` and `fetchTokenTransactions`; new `fetchAllNativeTransactions(address, apiKey, { cutoffTimestamp })` and `fetchAllTokenTransactions(address, apiKey, { cutoffTimestamp })` that paginate in 10k chunks and optionally stop at `cutoffTimestamp` (Unix seconds). Existing callers unchanged (two-arg calls behave as before).
- [x] **Backfill script** `scripts/backfill-firm-payouts-to-jan2025.js`: runs one firm at a time; use `--firm fundingpips` to test first. Uses paginated Arbiscan fetch and same payout logic as sync service.
- [ ] **Run backfill** (local or CI), then commit `data/propfirms/`. Test with one firm first: `ARBISCAN_API_KEY=... node scripts/backfill-firm-payouts-to-jan2025.js --firm fundingpips`.
