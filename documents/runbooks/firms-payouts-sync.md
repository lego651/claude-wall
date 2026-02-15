# Firm Payouts Sync

Dual-sync system for prop firm payout data from Arbiscan blockchain to application storage.

## Architecture

```
                      ┌─────────────────────────┐
                      │   Arbiscan API          │
                      │   (Source of Truth)     │
                      └──────────┬──────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                  │
        ┌───────▼────────┐              ┌────────▼────────┐
        │  Real-time     │              │  Historical     │
        │  (Supabase)    │              │  (JSON Files)   │
        │                │              │                 │
        │  Every 5min    │              │  Daily 3AM PST  │
        │  24h window    │              │  Calendar month │
        │  UTC-based     │              │  TZ-aware       │
        └───────┬────────┘              └────────┬────────┘
                │                                 │
        ┌───────▼────────┐              ┌────────▼────────┐
        │ API: period=1d │              │ API: 7d/30d/12m │
        │ Fast queries   │              │ Aggregations    │
        └────────────────┘              └─────────────────┘
```

## Real-time Sync (Supabase)

**Trigger:** Inngest cron `*/5 * * * *` (every 5 minutes)
**Location:** [lib/inngest-payouts.ts](../../lib/inngest-payouts.ts:11)
**Service:** [lib/services/payoutSyncService.js](../../lib/services/payoutSyncService.js)

### Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Fetch from firms (data/propfirms.json)                │
│    - Firm addresses from JSON config                     │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 2. Fetch Arbiscan data (parallel per address)            │
│    - fetchNativeTransactions()                           │
│    - fetchTokenTransactions()                            │
│    - Rate limit: 500ms between addresses                 │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 3. Filter to 24h window                                  │
│    cutoff = now - 24h                                    │
│    filter: tx.timestamp >= cutoff                        │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 4. Process & deduplicate                                 │
│    - Filter: amount >= $10 (spam filter)                 │
│    - Convert to USD using PRICES                         │
│    - Deduplicate by tx_hash                              │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 5. Upsert to Supabase                                    │
│    ON CONFLICT (tx_hash) DO UPDATE                       │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 6. Cleanup old data                                      │
│    DELETE WHERE timestamp < (now - 24h)                  │
└──────────────────────────────────────────────────────────┘
```

### Data Retention

Rolling 24-hour window in UTC:

```
        ◄──────────────────────────────────────►
        Yesterday 10:05          Today 10:05
        (cutoff)                 (now)

Sync at 10:00:  includes tx from 10:00 yesterday onwards
Sync at 10:05:  includes tx from 10:05 yesterday onwards
                tx from 10:00-10:05 yesterday deleted
```

### Key Points

- **Source:** Arbiscan Arbitrum API
- **Storage:** Supabase `recent_payouts` table (no table migration file, created externally)
- **Deduplication:** `tx_hash` unique constraint
- **Price conversion:** Hardcoded in [payoutSyncService.js:41-46](../../lib/services/payoutSyncService.js:41-46)
- **Cleanup:** After all firms synced, deletes data older than 24h
- **Updates:** Firm metadata (`last_payout_at`, `last_synced_at`)

## Historical Sync (JSON)

**Trigger:** GitHub Actions cron `0 11 * * *` (3 AM PST / 11:00 UTC)
**Workflow:** [.github/workflows/sync-firm-payouts-historical.yml](../../.github/workflows/sync-firm-payouts-historical.yml)
**Script:** [scripts/update-firm-monthly-json.js](../../scripts/update-firm-monthly-json.js)

### Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Get current month in firm's timezone                  │
│    getCurrentYearMonthInTimezone(firm.timezone)          │
│    Example: Asia/Dubai → "2025-02"                       │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 2. Fetch ALL transactions from Arbiscan                  │
│    - No time filter (fetches everything)                 │
│    - Rate limit: 300ms between calls                     │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 3. Filter to current month (timezone-aware)              │
│    - Convert UTC timestamp to local date                 │
│    - Filter: localMonth === targetMonth                  │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 4. Build daily buckets (timezone-aware)                  │
│    - Group by local date (YYYY-MM-DD)                    │
│    - Aggregate: total, rise, crypto, wire                │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 5. Compare with existing file                            │
│    if (existingCount === newCount) skip                  │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 6. Write JSON file                                       │
│    data/propfirms/{firmId}/{YYYY-MM}.json                │
│    Completely overwrites existing file                   │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 7. Git commit & push                                     │
│    Triggers Vercel redeploy (~2 min)                     │
└──────────────────────────────────────────────────────────┘
```

### Month Boundaries

Calendar month based on firm's local timezone:

```
Firm: fundingpips (UTC)
Month: 2025-02-01 00:00 UTC → 2025-03-01 00:00 UTC

Firm: example-dubai (Asia/Dubai, UTC+4)
Month: 2025-01-31 20:00 UTC → 2025-02-28 20:00 UTC
      (Feb 1 00:00 Dubai)    (Mar 1 00:00 Dubai)
```

### File Structure

```json
{
  "firmId": "fundingpips",
  "period": "2025-02",
  "timezone": "UTC",
  "generatedAt": "2025-02-13T11:05:00Z",
  "summary": {
    "totalPayouts": 125000,
    "payoutCount": 45,
    "largestPayout": 5000,
    "avgPayout": 2777
  },
  "dailyBuckets": [
    { "date": "2025-02-01", "total": 4500, "rise": 3000, "crypto": 1500, "wire": 0 },
    { "date": "2025-02-02", "total": 5200, "rise": 3500, "crypto": 1700, "wire": 0 }
  ],
  "transactions": [
    {
      "tx_hash": "0xabc...",
      "firm_id": "fundingpips",
      "amount": 1500,
      "payment_method": "crypto",
      "timestamp": "2025-02-01T10:30:00Z",
      "from_address": "0x1e1...",
      "to_address": "0x7f8..."
    }
  ]
}
```

### Key Points

- **Source:** Arbiscan Arbitrum API (same as real-time)
- **Storage:** Git-versioned JSON files in `data/propfirms/`
- **Timezone:** Per-firm timezone from [data/propfirms.json](../../data/propfirms.json)
- **Overwrite:** Completely replaces file (not incremental)
- **Deploy:** Auto-deploy via Vercel on git push
- **Frozen:** Previous months are frozen (no updates)

## Data Overlap

```
Timeline: 2025-02-13 10:00 UTC

Real-time (Supabase):
  ├─ 2025-02-12 10:00 UTC ─────► 2025-02-13 10:00 UTC ─┤
  └─ 24-hour rolling window (UTC)                      ┘

Historical (JSON, UTC firm):
  ├─ 2025-02-01 00:00 UTC ─────────────────────► Now ──┤
  └─ Current month (calendar boundary)                 ┘

Overlap zone:
  └─ 2025-02-12 10:00 UTC ─────► 2025-02-13 10:00 UTC ─┘
     Transactions should exist in BOTH systems
```

## Configuration

### Firms Config

[data/propfirms.json](../../data/propfirms.json)

```json
{
  "firms": [
    {
      "id": "fundingpips",
      "name": "FundingPips",
      "timezone": "UTC",
      "addresses": ["0x1e198Ad0608476EfA952De1cD8e574dB68df5f16"],
      "createdAt": "2025-01-17T00:00:00Z"
    }
  ]
}
```

### Prices

Hardcoded in both sync systems:

```javascript
const PRICES = {
  ETH: 2500,
  USDC: 1.00,
  USDT: 1.00,
  RISEPAY: 1.00,
};
```

### Tokens

Supported ERC-20 tokens:

```javascript
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];

const TOKEN_TO_METHOD = {
  'RISEPAY': 'rise',
  'USDC': 'crypto',
  'USDT': 'crypto',
  'ETH': 'crypto',
};
```

## Environment Variables

```bash
# Required for both syncs
ARBISCAN_API_KEY=<arbiscan-api-key>

# Real-time sync only
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Data Accuracy

### Real-time (Supabase)

**Guarantee:** Best-effort

**Risks:**
- Sync failure → gap in 24h window
- Arbiscan indexing lag (~30s, up to 5min)
- Cleanup timing race condition

**Mitigation:** Historical sync captures all data

### Historical (JSON)

**Guarantee:** Eventually consistent (high accuracy)

**Risks:**
- Arbiscan indexing lag (resolved next day)
- File write failure (rare)

**Mitigation:** Git versioned, GitHub Actions retries

## Timing

### Real-time

```
00:00 UTC → Sync #1
00:05 UTC → Sync #2
00:10 UTC → Sync #3
...
23:55 UTC → Sync #288

Total: 288 syncs/day
Latency: Max 5 minutes
```

### Historical

```
Daily at 11:00 UTC (3 AM PST)

Feb 1:  Updates 2025-02.json (first time)
Feb 2:  Overwrites 2025-02.json (adds new txs)
...
Mar 1:  Creates 2025-03.json
        2025-02.json now frozen
```

## Dependencies

### Real-time

1. Inngest cron trigger
2. Arbiscan API availability
3. Supabase database
4. Firm addresses in Supabase `firms` table

### Historical

1. GitHub Actions cron
2. Arbiscan API availability
3. [data/propfirms.json](../../data/propfirms.json) config
4. Vercel deployment webhook

## Related Files

- [lib/services/payoutSyncService.js](../../lib/services/payoutSyncService.js) - Real-time sync service
- [lib/inngest-payouts.ts](../../lib/inngest-payouts.ts) - Inngest cron job
- [scripts/update-firm-monthly-json.js](../../scripts/update-firm-monthly-json.js) - Historical sync script
- [.github/workflows/sync-firm-payouts-historical.yml](../../.github/workflows/sync-firm-payouts-historical.yml) - Daily workflow
- [data/propfirms.json](../../data/propfirms.json) - Firm configuration
- [lib/arbiscan.js](../../lib/arbiscan.js) - Arbiscan API client
- [documents/spikes/data-synchronization-deep-dive.md](../spikes/data-synchronization-deep-dive.md) - Detailed analysis
