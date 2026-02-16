# Trader Payouts Sync

Real-time sync system for individual trader wallet payout data from Arbiscan to Supabase.

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
      │  Every 5min    │              │  On backfill    │
      │  24h window    │              │  Monthly files  │
      │  UTC-based     │              │  UTC-based      │
      └───────┬────────┘              └────────┬────────┘
              │                                 │
      ┌───────▼────────┐              ┌────────▼────────┐
      │ API: Dashboard │              │ API: History    │
      │ Recent payouts │              │ Long-term data  │
      └────────────────┘              └─────────────────┘
```

## Key Differences from Firm Sync

| Aspect | Firm Sync | Trader Sync |
|--------|-----------|-------------|
| **Wallets** | ~8 firm addresses (fixed) | Variable per user |
| **Direction** | Outgoing (FROM firm) | Incoming (TO trader) |
| **Historical** | Daily cron (JSON) | Backfill on signup |
| **Volume** | High (1000s txs/month) | Low (10-50 txs/month) |
| **Arbiscan calls** | Per-firm rate limit | Per-trader rate limit |

## Real-time Sync (Supabase)

**Trigger:** Inngest cron `*/5 * * * *` (every 5 minutes)
**Location:** [lib/inngest-traders.ts:10](../../lib/inngest-traders.ts:10)
**Service:** [lib/services/traderRealtimeSyncService.js](../../lib/services/traderRealtimeSyncService.js)

### Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. Query profiles with wallet addresses                 │
│    SELECT id, wallet_address FROM profiles              │
│    WHERE wallet_address IS NOT NULL                     │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 2. Fetch Arbiscan data (per trader)                     │
│    - fetchNativeTransactions(walletAddress)             │
│    - fetchTokenTransactions(walletAddress)              │
│    - Rate limit: 500ms between traders                  │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 3. Filter to incoming + 24h window                      │
│    filter: tx.to === walletAddress.toLowerCase()        │
│    filter: tx.timestamp >= (now - 24h)                  │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 4. Process & deduplicate                                │
│    - Filter: amount >= $10 (spam filter)                │
│    - Convert to USD using PRICES                        │
│    - Deduplicate by tx_hash                             │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 5. Upsert to recent_trader_payouts                      │
│    ON CONFLICT (tx_hash) DO UPDATE                      │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 6. Cleanup old data                                     │
│    DELETE WHERE timestamp < (now - 24h)                 │
└──────────────────────────────────────────────────────────┘
```

### Data Retention

Rolling 24-hour window in UTC:

```
        ◄──────────────────────────────────────►
        Yesterday 10:05          Today 10:05
        (cutoff)                 (now)

Sync at 10:00:  includes tx TO trader from 10:00 yesterday onwards
Sync at 10:05:  includes tx TO trader from 10:05 yesterday onwards
                tx from 10:00-10:05 yesterday deleted
```

### Key Points

- **Source:** Arbiscan Arbitrum API
- **Storage:** Supabase `recent_trader_payouts` table
- **Direction:** **INCOMING** transactions (tx.to === trader wallet)
- **Deduplication:** `tx_hash` unique constraint
- **Price conversion:** Same as firm sync ([PRICES](../../lib/services/traderRealtimeSyncService.js:16))
- **Cleanup:** After all traders synced, deletes data older than 24h
- **Profiles:** Only sync wallets linked to user accounts

## Historical Sync (JSON + Supabase)

**Trigger:** First wallet link (OAuth callback)
**Location:** [app/api/auth/callback/route.js:210-275](../../app/api/auth/callback/route.js:210-275)
**Script:** `scripts/backfill-trader-history.js` (via exec)

### Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. User links wallet during OAuth                       │
│    - Google sign-in → callback sets pending_wallet      │
│    - OR wallet first → cookie → OAuth → callback        │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 2. OAuth callback detects new wallet                    │
│    if (walletAddress && !existingProfile.wallet)        │
│    triggerBackfill(walletAddress, userId)               │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 3. Run backfill script (fire-and-forget)                │
│    node scripts/backfill-trader-history.js <address>    │
│    timeout: 5 minutes                                   │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 4. Fetch ALL transactions from Arbiscan                 │
│    - No time filter (entire history)                    │
│    - Rate limit: 300ms between calls                    │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 5. Group by month (UTC)                                 │
│    - Group by YYYY-MM (local UTC date)                  │
│    - Build monthly aggregations                         │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 6. Write monthly JSON files                             │
│    data/traders/<wallet>/<YYYY-MM>.json                 │
│    Create directory if needed                           │
└──────────────┬───────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────┐
│ 7. Update profile.backfilled_at                         │
│    Mark backfill complete in Supabase                   │
└──────────────────────────────────────────────────────────┘
```

### File Structure

Similar to firm sync, but stored per wallet address:

```
data/traders/
├── 0x1c969652d758f8fc23c443758f8911086f676216/
│   ├── 2024-06.json
│   ├── 2024-08.json
│   └── 2025-01.json
└── 0x0074fa9c170e12351afabd7df0ebd0aed2a5eab3/
    └── 2026-01.json
```

**File format:**

```json
{
  "walletAddress": "0x1c969652d758f8fc23c443758f8911086f676216",
  "period": "2025-01",
  "timezone": "UTC",
  "generatedAt": "2025-01-28T17:17:00Z",
  "summary": {
    "totalPayouts": 12500,
    "payoutCount": 5,
    "largestPayout": 3500,
    "avgPayout": 2500
  },
  "transactions": [
    {
      "tx_hash": "0xabc...",
      "wallet_address": "0x1c969...",
      "amount": 2500,
      "payment_method": "crypto",
      "timestamp": "2025-01-15T10:30:00Z",
      "from_address": "0x1e1...",
      "to_address": "0x1c969..."
    }
  ]
}
```

### Key Points

- **Trigger:** Once per wallet (on first link)
- **Storage:** Git-versioned JSON in `data/traders/<wallet>/`
- **Timezone:** UTC (always)
- **Background:** Runs async, doesn't block OAuth redirect
- **Timeout:** 5 minutes max (handles large wallets)
- **Idempotent:** Safe to re-run (overwrites files)
- **Marker:** Sets `backfilled_at` in profiles table

## Combined Data Loading

**Service:** [lib/services/traderDataLoader.js](../../lib/services/traderDataLoader.js)

Combines historical (JSON) + recent (Supabase) for complete view:

```javascript
// 1. Load historical from JSON files
const historical = await getAllTraderTransactions(walletAddress);

// 2. Load recent from Supabase
const recent = await getRecentTraderPayouts(walletAddress);

// 3. Merge and deduplicate by tx_hash
const all = mergeTransactions(historical, recent);
```

**Used by:**
- Dashboard: Show recent + historical payouts
- Stats: Total lifetime earnings
- Charts: 7d/30d/12m aggregations

## Rate Limits

### Arbiscan API

**Free tier:**
- 5 calls/second
- ~100k calls/day

**Our usage (5-min cron, 10 traders):**

```
Real-time sync (every 5 min):
  10 traders × 2 calls (native + token) = 20 calls/5min
  = 240 calls/hour
  = 5,760 calls/day

Backfill (per new user):
  1 trader × 2 calls (native + token) = 2 calls
  + paginated calls if >10k txs (rare for traders)

Total daily: 5,760 + (new users × 2)
Max safe: ~10k calls/day → ~2k new signups/day
```

**Rate limiting in code:**

```javascript
// Between traders
await new Promise(resolve => setTimeout(resolve, 500)); // 500ms

// Between API calls (pagination)
delayMs: 500 // in fetchAllNativeTransactions
```

### Supabase

**Free tier:**
- 500 MB database
- Unlimited API requests
- 2 GB egress/month

**Our usage (10 traders):**

```
recent_trader_payouts table:
  10 traders × 50 txs/month × 24h window
  = ~20 rows at any time
  = <1 KB (negligible)

trader_records table:
  10 traders × 1 row/trader
  = 10 rows
  = <1 KB (negligible)

JSON files (data/traders/):
  10 traders × 12 months × 1 KB/file
  = 120 KB (git repo)
  = <1 MB (very safe)
```

**Egress:**

```
Dashboard loads:
  100 users × 10 pageviews/day × 1 KB/query
  = 1 MB/day egress
  = 30 MB/month (well under 2 GB limit)
```

## Storage Scaling

### Current State (10 traders)

```
data/traders/: 32 KB total (8 files)
Average file: 680 bytes - 1.5 KB
Supabase: <1 KB (20 rows)
```

### Projected Growth

| Traders | JSON files | Total size | Supabase | Safe? |
|---------|-----------|------------|----------|-------|
| 10 | 80 | 64 KB | 1 KB | ✅ Yes |
| 100 | 800 | 640 KB | 10 KB | ✅ Yes |
| 1,000 | 8,000 | 6.4 MB | 100 KB | ✅ Yes |
| 10,000 | 80,000 | 64 MB | 1 MB | ⚠️ Git slow |
| 100,000 | 800,000 | 640 MB | 10 MB | ❌ Git limit |

**Git limit:** ~100 MB repo size recommended
**Our limit:** ~10,000 traders before optimization needed

### Optimization (if >10k traders)

1. **JSON → Supabase migration:**
   - Create `trader_monthly_payouts` table
   - Store monthly aggregations in DB
   - Keep only last 12 months in JSON

2. **S3/CDN storage:**
   - Move JSON files to S3
   - Serve via CDN for fast access
   - Git stores only metadata

3. **Lazy backfill:**
   - Don't backfill on signup
   - Only backfill when user visits dashboard
   - Track `backfill_requested_at` in profiles

## Configuration

### Prices

Same as firm sync:

```javascript
const PRICES = {
  ETH: 2500,
  USDC: 1.00,
  USDT: 1.00,
  RISEPAY: 1.00,
};
```

### Tokens

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
# Required for both sync types
ARBISCAN_API_KEY=<arbiscan-api-key>

# Real-time sync + backfill
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Database Schema

### recent_trader_payouts

```sql
CREATE TABLE recent_trader_payouts (
  tx_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  from_address TEXT,
  to_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recent_trader_payouts_wallet
  ON recent_trader_payouts(wallet_address, timestamp DESC);
```

### trader_records

```sql
CREATE TABLE trader_records (
  wallet_address TEXT PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  total_payout_usd NUMERIC DEFAULT 0,
  last_30_days_payout_usd NUMERIC DEFAULT 0,
  avg_payout_usd NUMERIC DEFAULT 0,
  payout_count INTEGER DEFAULT 0,
  first_payout_at TIMESTAMPTZ,
  last_payout_at TIMESTAMPTZ,
  last_payout_tx_hash TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### profiles (wallet field)

```sql
ALTER TABLE profiles
ADD COLUMN wallet_address TEXT UNIQUE,
ADD COLUMN backfilled_at TIMESTAMPTZ;
```

## Data Flow Diagram

```
User Signup
    │
    ├─► Google Auth ──► OAuth Callback
    │                       │
    │                       ├─► Link wallet to profile
    │                       │
    │                       └─► triggerBackfill()
    │                               │
    │                               ├─► Fetch history (Arbiscan)
    │                               │
    │                               ├─► Write JSON files
    │                               │
    │                               └─► Update backfilled_at
    │
    └─► Inngest Cron (every 5 min)
            │
            ├─► Fetch recent (Arbiscan)
            │
            ├─► Filter to 24h window
            │
            └─► Upsert to recent_trader_payouts

Dashboard Load
    │
    ├─► Load historical (JSON files)
    │
    ├─► Load recent (Supabase)
    │
    └─► Merge & deduplicate
```

## Monitoring

### Health Checks

1. **Inngest dashboard:**
   - Check `sync-trader-payouts` runs every 5 min
   - Monitor error rate

2. **Supabase:**
   - Query `recent_trader_payouts` row count (~20 rows)
   - Check `trader_records.last_synced_at` freshness

3. **Git repo:**
   - Check `data/traders/` directory size
   - Monitor file count growth

### Troubleshooting

**No recent payouts:**
```sql
-- Check last sync time
SELECT wallet_address, last_synced_at, sync_error
FROM trader_records
ORDER BY last_synced_at DESC;

-- Check recent payouts table
SELECT COUNT(*), MAX(timestamp) AS latest
FROM recent_trader_payouts;
```

**Backfill failed:**
```sql
-- Check backfill status
SELECT wallet_address, backfilled_at, created_at
FROM profiles
WHERE wallet_address IS NOT NULL;
```

**JSON files missing:**
```bash
# Check file count
find data/traders -type f -name "*.json" | wc -l

# Check specific trader
ls -lh data/traders/0x1c969652d758f8fc23c443758f8911086f676216/
```

## Related Files

- [lib/services/traderRealtimeSyncService.js](../../lib/services/traderRealtimeSyncService.js) - Real-time sync
- [lib/services/traderDataLoader.js](../../lib/services/traderDataLoader.js) - Combined loader
- [lib/inngest-traders.ts](../../lib/inngest-traders.ts) - Inngest cron
- [app/api/auth/callback/route.js](../../app/api/auth/callback/route.js) - Backfill trigger
- [app/api/wallet/validate/route.js](../../app/api/wallet/validate/route.js) - Wallet validation
- [lib/arbiscan.js](../../lib/arbiscan.js) - Arbiscan API client
- [documents/runbooks/firms-payouts-sync.md](./firms-payouts-sync.md) - Firm sync (reference)
