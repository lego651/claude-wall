# Data Syncing Architecture for `/propfirms` and `/propfirm/[id]`

## Overview

The system uses a **hybrid architecture** combining real-time data (Supabase) and historical aggregated data (static JSON files) to optimize performance and cost.

---

## 🏗️ Architecture Components

### 1. Data Sources

- **Arbiscan API** (Blockchain Explorer) - Primary source of truth for on-chain transaction data
- **Supabase** (PostgreSQL) - Stores recent real-time data (last 24 hours)
- **JSON Files** - Pre-aggregated historical data (`data/payouts/[firmId]/YYYY-MM.json`)

### 2. Data Flow

```
Arbiscan API (Blockchain)
    ↓
Inngest (Every 5 min) + GitHub Actions (Daily)
    ↓
    ├─→ Supabase (recent_payouts table) ← Real-time (24h rolling window)
    └─→ JSON Files (data/payouts/) ← Historical (7d, 30d, 12m)
          ↓
      Git Commit & Push
          ↓
      Vercel Deploy (reads JSON from filesystem)
```

---

## ⚙️ Data Sync Mechanisms

### A. Real-time Sync (Every 5 minutes)

**Scheduler:** Inngest (cron)
**Endpoint:** `app/api/inngest/route.ts`
**Function:** `libs/inngest-payouts.ts`
**Logic:** `lib/services/payoutSyncService.js` (`syncAllFirms`)

```javascript
// Runs: Every 5 minutes
// Updates: Supabase `recent_payouts` table
// Window: Last 24 hours only
```

**What it does:**
1. Fetches latest transactions from Arbiscan for each firm
2. Filters to last 24 hours
3. Upserts into Supabase `recent_payouts` table
4. Updates `firms.last_payout_at` timestamp

**Used by:**
- `/api/v2/propfirms?period=1d` - Latest 24h metrics
- `/api/v2/propfirms/[id]/latest-payouts` - Recent payout feed

---

### B. Historical Sync (Daily at 3 AM PST)

**Workflow:** `.github/workflows/sync-firm-payouts-historical.yml`
**Script:** `scripts/update-monthly-json.js`

```javascript
// Runs: Daily at 11:00 UTC (3 AM PST)
// Updates: JSON files in data/payouts/[firmId]/YYYY-MM.json
// Commits: Changes to git
```

**What it does:**
1. Fetches current month's data from Arbiscan
2. Generates aggregated metrics:
   - **summary**: `totalPayouts`, `payoutCount`, `largestPayout`, `avgPayout`
   - **dailyBuckets**: Daily totals by payment method (rise/crypto/wire)
   - **transactions**: Full transaction list for the month
3. Writes to `data/payouts/[firmId]/YYYY-MM.json`
4. Git commits and pushes changes
5. Triggers Vercel redeployment

**JSON Structure:**
```json
{
  "firmId": "alphacapitalgroup",
  "period": "2025-04",
  "timezone": "UTC",
  "generatedAt": "2026-01-21T15:43:44.939Z",
  "summary": {
    "totalPayouts": 2236257,
    "payoutCount": 1001,
    "largestPayout": 32475,
    "avgPayout": 2234
  },
  "dailyBuckets": [
    { "date": "2025-04-01", "total": 22431, "rise": 22431, "crypto": 0, "wire": 0 }
  ],
  "transactions": [
    {
      "tx_hash": "0x...",
      "firm_id": "alphacapitalgroup",
      "amount": 5000,
      "payment_method": "rise",
      "timestamp": "2025-04-01T10:30:00.000Z",
      "from_address": "0x...",
      "to_address": "0x..."
    }
  ]
}
```

**Used by:**
- `/api/v2/propfirms?period=7d|30d|12m` - Historical metrics
- `/api/v2/propfirms/[id]/chart?period=30d|12m` - Chart data
- `/api/v2/propfirms/[id]/top-payouts?period=30d|12m` - Largest payouts

---

## 📊 API Endpoints & Data Sources

### 1. `/api/v2/propfirms` (List View)

**File:** `app/api/v2/propfirms/route.js`

**Logic:**
```javascript
if (period === '1d') {
  // Query Supabase recent_payouts table
  // Calculate metrics from last 24h transactions
} else {
  // Load from JSON files using payoutDataLoader
  // Use pre-aggregated summary metrics
}
```

**Examples:**
- `?period=1d` → Supabase query (real-time)
- `?period=30d` → Reads `2025-01.json` + `2024-12.json` → Filters last 30 days
- `?period=12m` → Reads last 12 monthly JSON files → Aggregates

---

### 2. `/api/v2/propfirms/[id]/chart` (Detail View Chart)

**File:** `app/api/v2/propfirms/[id]/chart/route.js`
**Data Source:** Historical JSON only (30d or 12m)

**Logic:**
```javascript
// 1. Fetch firm metadata from Supabase (name, logo, website)
// 2. Load historical data from JSON using payoutDataLoader
// 3. For 30d: return dailyBuckets (fill gaps with zeros)
// 4. For 12m: return monthlyBuckets
// 5. Merge live last_payout_at from Supabase
```

---

### 3. `/api/v2/propfirms/[id]/top-payouts`

**File:** `app/api/v2/propfirms/[id]/top-payouts/route.js`
**Data Source:** Historical JSON only

```javascript
// Load transactions from JSON files
// Sort by amount descending
// Filter to 'rise' payment method only
// Return top 10
```

---

### 4. `/api/v2/propfirms/[id]/latest-payouts`

**File:** `app/api/v2/propfirms/[id]/latest-payouts/route.js`
**Data Source:** Supabase only (real-time)

```javascript
// Query recent_payouts table
// Filter: last 24 hours
// Order by timestamp DESC
// Return all payouts with Arbiscan links
```

---

## 🔧 Data Loader Utility

**File:** `lib/services/payoutDataLoader.js`

**Key Functions:**

1. **`loadMonthlyData(firmId, 'YYYY-MM')`** - Load single month JSON
2. **`loadPeriodData(firmId, '7d|30d|12m')`** - Smart aggregation:
   - Loads relevant month files
   - Filters by date range
   - Calculates summary metrics
   - Returns buckets for charts
3. **`getTopPayoutsFromFiles(firmId, period, limit)`** - Extract top transactions

---

## 🎯 Why This Architecture?

| Aspect | Real-time (Supabase) | Historical (JSON) |
|--------|---------------------|-------------------|
| **Data** | Last 24 hours | 7d, 30d, 12m |
| **Update Frequency** | Every 30 min | Daily |
| **Query Speed** | ~100ms | ~5ms (filesystem) |
| **Cost** | Supabase reads | Free (static files) |
| **Use Case** | Latest activity feed | Charts, leaderboards |

**Benefits:**
- ✅ **Performance:** Historical data served from static files (ultra-fast)
- ✅ **Cost:** Minimize Supabase queries for expensive aggregations
- ✅ **Freshness:** Real-time 24h window for live activity
- ✅ **Reliability:** JSON files committed to git (version control)
- ✅ **Scalability:** Pre-aggregated data reduces compute load

---

## 📱 Frontend Data Flow

### `/propfirms` Page

**File:** `app/propfirms/page.js:84`

```javascript
useEffect(() => {
  fetch(`/api/v2/propfirms?period=${period}&sort=${sort}&order=${order}`)
    .then(response => response.json())
    .then(data => setFirms(data.data));
}, [period, sort, order]);
```

### `/propfirm/[id]` Page

**File:** `app/propfirm/[id]/page.js:28`

```javascript
// Three parallel API calls
useEffect(() => {
  // 1. Chart data (30d/12m) → Historical JSON
  fetch(`/api/v2/propfirms/${id}/chart?period=${chartPeriod}`);
}, [id, chartPeriod]);

useEffect(() => {
  // 2. Top payouts → Historical JSON
  fetch(`/api/v2/propfirms/${id}/top-payouts?period=${chartPeriod}`);
}, [id, chartPeriod]);

useEffect(() => {
  // 3. Latest feed → Supabase real-time
  fetch(`/api/v2/propfirms/${id}/latest-payouts`);
}, [id]);
```

---

## 🔄 Summary: Complete Data Sync Flow

1. **Every 30 minutes:**
   - GitHub Action fetches latest blockchain data
   - Updates Supabase `recent_payouts` table (rolling 24h window)
   - Frontend gets live data via API

2. **Daily at 3 AM PST:**
   - GitHub Action fetches current month's data
   - Generates/updates JSON files in `data/payouts/`
   - Commits to git → Triggers Vercel deploy
   - Frontend reads pre-aggregated historical data

3. **User visits page:**
   - Period = **1d** → Query Supabase (real-time)
   - Period = **7d/30d/12m** → Read JSON files (historical)
   - Latest feed → Always Supabase (24h real-time)

---

## 🌐 Arbiscan API Details

### API Call Analysis

#### **Real-time Sync (Every 30 minutes)**

**Current Implementation:** `scripts/sync-to-supabase.js:164`

For each firm:
```javascript
for (const address of firm.addresses) {
  const [native, tokens] = await Promise.all([
    fetchNativeTransactions(address, apiKey),  // 1 call
    fetchTokenTransactions(address, apiKey),   // 1 call
  ]);
  // 2 calls per address
  await sleep(500); // Rate limit delay
}
```

**Calculation:**
- **Firms:** 8 (from `data/propfirms.json`)
- **Addresses per firm:** 1 (all firms have 1 address currently)
- **Calls per address:** 2 (native + token)
- **Total calls per sync:** 8 firms × 1 address × 2 calls = **16 API calls**
- **Frequency:** Every 30 minutes
- **Daily calls:** 16 × 48 = **768 calls/day**

---

#### **Historical Sync (Daily at 3 AM PST)**

**Current Implementation:** `scripts/update-monthly-json.js:317`

For each firm:
```javascript
for (const address of firm.addresses) {
  const { native, tokens } = await fetchAllTransactions(address, apiKey);
  // fetchNativeTransactions() → 1 call
  // sleep(300ms)
  // fetchTokenTransactions() → 1 call
  // 2 calls per address
  await sleep(500); // Between addresses
}
```

**Calculation:**
- **Firms:** 8
- **Addresses per firm:** 1
- **Calls per address:** 2 (native + token)
- **Total calls per sync:** 8 firms × 1 address × 2 calls = **16 API calls**
- **Frequency:** Once per day
- **Daily calls:** **16 calls/day**

---

### **Total Arbiscan API Usage**

| Sync Type | Calls per Run | Runs per Day | Daily Calls |
|-----------|--------------|--------------|-------------|
| Real-time | 16 | 48 | 768 |
| Historical | 16 | 1 | 16 |
| **TOTAL** | | | **784 calls/day** |

**Monthly:** 784 × 30 = **~23,520 calls/month**

---

### Arbiscan API Rate Limits

**Based on Etherscan/Arbiscan documentation:**

| Plan | Rate Limit | Monthly Calls | Cost |
|------|-----------|--------------|------|
| **Free** | 5 calls/sec | 100,000/day | $0 |
| **Standard** | 5 calls/sec | Unlimited | $99/month |
| **Advanced** | 30 calls/sec | Unlimited | $299/month |

**Current Status:**
- ✅ **Free tier is sufficient** (784/day << 100,000/day)
- ✅ Current implementation respects rate limits (500ms delays)
- ✅ No batch API available (Arbiscan doesn't support batch queries)

---

### Can We Do Batch Calls?

**No.** Arbiscan/Etherscan API does **not support batch requests**. Each address must be queried individually:

```javascript
// ❌ No batch endpoint like this exists:
GET /api?action=txlist&addresses=0x123,0x456,0x789

// ✅ Must do individual calls:
GET /api?action=txlist&address=0x123
GET /api?action=txlist&address=0x456
GET /api?action=txlist&address=0x789
```

**Workaround:** Use `Promise.all()` for parallel calls (already implemented), but still respect rate limits.

---

### Arbiscan API Pros & Cons

#### ✅ **Pros**

1. **Free tier is generous**
   - 100,000 calls/day (we use <1%)
   - 5 calls/sec sufficient for current scale

2. **Reliable data source**
   - Blockchain data is immutable
   - No data corruption or inconsistency
   - Arbiscan uptime is excellent

3. **Comprehensive data**
   - Native ETH transactions
   - All ERC-20 token transfers
   - Full transaction history available

4. **No authentication complexity**
   - Simple API key in URL
   - No OAuth, JWT, etc.

5. **Flexible filtering**
   - Sort by timestamp
   - Filter by address (from/to)
   - No pagination limits

---

#### ❌ **Cons**

1. **No batch queries**
   - Must query each address individually
   - Scaling to 100+ firms = 200+ calls per sync
   - Wastes API quota

2. **Rate limit constraints**
   - 5 calls/sec on free tier
   - Must add delays (slows down sync)
   - For 8 firms × 2 calls: ~3 seconds minimum

3. **No webhook/push notifications**
   - Must poll for new transactions
   - Can't get instant updates
   - Current 30-min polling is a tradeoff

4. **Redundant data transfer**
   - Each call returns ALL transactions (up to 10,000)
   - We only need last 24h, but get entire history
   - No `since` parameter for incremental fetches

5. **No aggregation API**
   - Can't ask "sum of all payouts in last 30 days"
   - Must fetch raw transactions and compute locally
   - More processing on our end

6. **Vendor lock-in**
   - Tied to Arbiscan for Arbitrum chain
   - If Arbiscan goes down or changes API, we're blocked
   - No alternative providers

7. **No data freshness guarantee**
   - Arbiscan indexes blockchain with slight delay (~30 sec)
   - "Real-time" is actually "near real-time"
   - Edge case: Transaction confirmed but not indexed yet

8. **Limited support for complex queries**
   - Can't filter by transaction value
   - Can't filter by multiple tokens in one call
   - Must fetch all, then filter client-side

---

### Optimization Opportunities

#### 1. **Use Block Numbers for Incremental Fetches**

Currently fetching ALL transactions, then filtering:

```javascript
// ❌ Current: Fetch everything every time
const allTxs = await fetchTokenTransactions(address, apiKey);
const last24h = allTxs.filter(tx => tx.timestamp > cutoff);
```

**Better approach:**

```javascript
// ✅ Track last synced block, only fetch new blocks
const lastSyncedBlock = await getLastSyncedBlock(firmId);
const newTxs = await fetchTokenTransactions(
  address,
  apiKey,
  { startBlock: lastSyncedBlock, endBlock: 'latest' }
);
```

**Impact:** Reduces data transfer from ~10,000 txs → ~10 txs per call

---

#### 2. **Cache Transaction History**

Store full transaction history in Supabase, only fetch NEW transactions:

```javascript
// Current: Fetch all, filter to 24h, upsert
// Better: Fetch since last sync, append to database
```

**Benefits:**
- Faster sync (less data processing)
- Enables historical queries without JSON files
- Reduces API calls (only fetch increments)

**Tradeoffs:**
- More Supabase storage costs
- More complex sync logic

---

#### 3. **Dynamic Polling Frequency**

Adjust sync frequency based on firm activity:

```javascript
// Active firms (recent payouts) → Every 15 min
// Inactive firms (no payouts in 7d) → Every 4 hours
```

**Impact:** Could reduce API calls by 50%+ without losing freshness for active firms

---

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| API rate limit hit | Low | High | Increase delays, switch to paid tier |
| Arbiscan downtime | Low | High | Cache last known state, show stale data |
| API key exposed | Medium | Medium | Use GitHub Secrets, rotate keys |
| Exceeding free tier | Low | Low | Monitor usage, ~3% of limit today |
| Blockchain reorg | Very Low | Medium | Arbiscan handles this, no action needed |

---

## 🚀 Scaling Considerations

### When This Architecture Breaks

1. **50+ firms:**
   - Real-time sync takes 50s+ (hits GitHub Actions timeout)
   - Need to parallelize or split into multiple jobs

2. **Multiple addresses per firm:**
   - Some firms have 5-10 payout wallets
   - API calls scale linearly: 50 firms × 5 addresses × 2 = **500 calls/sync**
   - Would need paid Arbiscan plan

3. **Sub-minute real-time:**
   - Can't poll faster than 5 minutes on GitHub Actions (billing)
   - Would need dedicated server or edge function

4. **Global traffic spike:**
   - JSON files served from Vercel edge
   - Should handle 10k+ concurrent users fine
   - Supabase free tier: 500 concurrent connections (might hit this)

---

**This hybrid approach gives you sub-second page loads for historical data while maintaining real-time freshness for recent activity!** 🚀
