# Data Synchronization Deep Dive - PropFirms System

**Date**: 2026-02-13
**Focus**: Real-time vs Historical sync mechanics, accuracy guarantees, gap detection

---

## Table of Contents

1. [Overview: Two Parallel Sync Systems](#1-overview-two-parallel-sync-systems)
2. [Real-time Sync (Supabase) - Rolling 24h Window](#2-real-time-sync-supabase---rolling-24h-window)
3. [Historical Sync (JSON Files) - Daily 3 AM PST](#3-historical-sync-json-files---daily-3-am-pst)
4. [Data Overlap Analysis](#4-data-overlap-analysis)
5. [Data Accuracy Guarantees](#5-data-accuracy-guarantees)
6. [Gap Detection & Resolution](#6-gap-detection--resolution)
7. [Recommended Improvements](#7-recommended-improvements)

---

## 1. Overview: Two Parallel Sync Systems

### Why Two Systems?

The architecture uses **two independent sync mechanisms** for different use cases:

```
┌────────────────────────────────────────────────────────────────┐
│                    ARBISCAN API (Source of Truth)              │
│              https://arbiscan.io/tx/[hash]                     │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ (fetches data)
                              ▼
        ┌─────────────────────────────────────────┐
        │         TWO INDEPENDENT SYNCS            │
        └─────────────────────────────────────────┘
                 │                        │
                 │                        │
        ┌────────▼────────┐      ┌───────▼────────┐
        │  REAL-TIME      │      │  HISTORICAL    │
        │  (Supabase)     │      │  (JSON Files)  │
        │                 │      │                │
        │  Every 5 min    │      │  Daily 3 AM    │
        │  Rolling 24h    │      │  Calendar mo.  │
        │  UTC-based      │      │  TZ-aware      │
        └────────┬────────┘      └───────┬────────┘
                 │                        │
                 │                        │
        ┌────────▼────────┐      ┌───────▼────────┐
        │  API: period=1d │      │  API: 7d/30d/12m│
        │  (Fast queries) │      │  (Aggregations) │
        └─────────────────┘      └─────────────────┘
```

**Key Point**: These syncs **DO NOT coordinate** with each other! They independently fetch from Arbiscan and use different filtering logic.

---

## 2. Real-time Sync (Supabase) - Rolling 24h Window

### 2.1 Trigger & Frequency

**Trigger**: Inngest cron job
**Schedule**: `*/5 * * * *` (every 5 minutes)
**Location**: [`libs/inngest-payouts.ts:11`](libs/inngest-payouts.ts:11)

```typescript
// Runs every 5 minutes, 24/7
cron: "*/5 * * * *"
```

**Execution Times** (examples):
```
00:00 UTC → Sync #1
00:05 UTC → Sync #2
00:10 UTC → Sync #3
...
23:55 UTC → Sync #288 (last of day)

Total: 288 syncs per day
```

### 2.2 Rolling Window Mechanism

**How it works**:

```javascript
// lib/services/payoutSyncService.js:54-55
const now = Date.now() / 1000; // Current Unix timestamp (seconds)
const cutoff24h = now - (24 * 60 * 60); // 86,400 seconds ago

// Filter: Only include transactions with timestamp >= cutoff24h
```

**Example Timeline**:

```
Current time: 2025-02-13 10:05:00 UTC (Unix: 1739439900)
Cutoff time:  2025-02-12 10:05:00 UTC (Unix: 1739353500)

┌────────────────────────────────────────────────────────────┐
│                     24-HOUR WINDOW                         │
│   ◄─────────────────────────────────────────────────►     │
│   10:05 yesterday                     10:05 today          │
│   (cutoff)                            (now)                │
└────────────────────────────────────────────────────────────┘

Included: All transactions from 2025-02-12 10:05:00 onwards
Excluded: All transactions before 2025-02-12 10:05:00
```

**⚠️ CRITICAL: The window SLIDES with every sync!**

```
Sync at 10:00:
  Cutoff = 10:00 yesterday
  Includes: Tx at 09:55 yesterday ✅

Sync at 10:05:
  Cutoff = 10:05 yesterday
  Includes: Tx at 09:55 yesterday ❌ (now excluded!)
```

**This means**: Every 5 minutes, the "oldest" 5 minutes of data gets **deleted** from Supabase.

### 2.3 Data Flow (Step-by-Step)

**Step 1: Fetch from Arbiscan**
```javascript
// For each firm address
const native = await fetchNativeTransactions(address, apiKey);
const tokens = await fetchTokenTransactions(address, apiKey);

// Returns ALL historical transactions (no time filter on Arbiscan API)
```

**Step 2: Filter to 24h Window**
```javascript
// lib/services/payoutSyncService.js:59-74
const nativePayouts = nativeData
  .filter(tx => lowerAddresses.includes(tx.from.toLowerCase())) // From firm wallet
  .filter(tx => parseInt(tx.timeStamp) >= cutoff24h)           // ✅ TIME FILTER
  .map(tx => ({
    tx_hash: tx.hash,
    firm_id: firmId,
    amount: (parseFloat(tx.value) / 1e18) * PRICES.ETH,
    payment_method: 'crypto',
    timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
    from_address: tx.from,
    to_address: tx.to,
  }));
```

**Step 3: Deduplicate & Filter Spam**
```javascript
// Combine native + token transactions
const allPayouts = [...nativePayouts, ...tokenPayouts]
  .filter(p => p.amount >= 10); // Remove spam (<$10)

// Deduplicate by transaction hash
const uniquePayouts = Array.from(
  new Map(allPayouts.map(p => [p.tx_hash, p])).values()
);
```

**Step 4: Upsert to Supabase**
```javascript
// lib/services/payoutSyncService.js:166-173
await supabase
  .from('recent_payouts')
  .upsert(payouts, { onConflict: 'tx_hash' }); // ✅ Prevents duplicates

// SQL equivalent:
// INSERT INTO recent_payouts (...)
// VALUES (...)
// ON CONFLICT (tx_hash) DO UPDATE SET
//   amount = EXCLUDED.amount,
//   timestamp = EXCLUDED.timestamp,
//   ...
```

**Key Point**: If a transaction already exists (same `tx_hash`), it gets **updated**, not duplicated.

**Step 5: Cleanup Old Data**
```javascript
// lib/services/payoutSyncService.js:248-266
async function cleanupOldPayouts(hoursToKeep = 24) {
  const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();

  await supabase
    .from('recent_payouts')
    .delete()
    .lt('timestamp', cutoffDate); // DELETE WHERE timestamp < cutoff

  // This runs AFTER all firms are synced
}
```

**SQL equivalent**:
```sql
DELETE FROM recent_payouts
WHERE timestamp < (NOW() - INTERVAL '24 hours');
```

**⚠️ CRITICAL: This cleanup happens AFTER sync, not before!**

**Timeline**:
```
10:00 - Start sync
10:00 - Fetch Arbiscan data (cutoff = 10:00 yesterday)
10:02 - Upsert new payouts to Supabase
10:03 - Cleanup old payouts (DELETE < 10:03 yesterday)
10:03 - Sync complete

Result: Supabase now contains payouts from 10:03 yesterday to 10:03 today
```

### 2.4 Is the 24h Data Always Accurate?

**Answer**: ⚠️ **NO, there are accuracy gaps!**

**Scenario 1: Sync Failure (Most Common Risk)**

```
Timeline:
09:55 - Sync #N succeeds
       Cutoff: 09:55 yesterday
       Supabase contains: Transactions from 09:55 yesterday onwards

10:00 - Sync #N+1 FAILS (Arbiscan API timeout)
       ❌ No update to Supabase

10:05 - Sync #N+2 succeeds
       Cutoff: 10:05 yesterday
       Supabase contains: Transactions from 10:05 yesterday onwards

❌ GAP: Transactions between 09:55 and 10:05 yesterday are MISSING!
       (They were in the window at 09:55, but excluded at 10:05)
```

**Why does this happen?**

The cleanup logic deletes based on **current time**, not **last successful sync time**:

```javascript
// Cleanup uses NOW, not last_synced_at
const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString();
```

**Scenario 2: Arbiscan Indexing Lag**

Arbiscan indexes transactions ~30 seconds after they're mined, but during high network congestion, this can be 5+ minutes.

```
10:00:00 - Transaction X mined on Arbitrum blockchain
10:00:30 - Arbiscan indexes transaction X (normal)
10:01:00 - Real-time sync runs, fetches transaction X ✅

But during congestion:
10:00:00 - Transaction Y mined
10:05:00 - Real-time sync runs, Arbiscan hasn't indexed Y yet
10:06:00 - Arbiscan indexes transaction Y
10:10:00 - Next sync runs, but cutoff is now 10:10 yesterday
           Transaction Y (at 10:00 today) is included ✅

This case is OK because Y is still within 24h window.
```

**Scenario 3: Blockchain Reorg (Rare)**

Arbitrum rarely reorganizes, but it can happen:

```
10:00 - Block 12345 contains Transaction Z
10:05 - Sync fetches Z, writes to Supabase ✅
10:10 - Arbitrum reorganizes, block 12345 replaced
        Transaction Z disappears!
10:15 - Sync runs, Arbiscan no longer returns Z
        But Z still in Supabase (upsert doesn't delete)

❌ STALE DATA: Supabase contains transaction that no longer exists
```

**How to detect**: Check `tx_hash` on Arbiscan. If returns 404, transaction was orphaned.

**Scenario 4: Multiple Syncs in Same Minute**

Inngest can sometimes trigger jobs twice (rare bug):

```
10:05:00 - Sync A starts, cutoff = 10:05 yesterday
10:05:30 - Sync B starts (duplicate trigger), cutoff = 10:05 yesterday

Both syncs fetch same data, both upsert → No duplicates (tx_hash is unique)

✅ SAFE: Upsert handles concurrent writes gracefully
```

### 2.5 Data Retention in Supabase

**Current State at Any Time**:
```sql
SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
FROM recent_payouts;

-- Expected result:
--  count  |         min         |         max
-- --------+---------------------+---------------------
--   500   | 2025-02-12 10:05:00 | 2025-02-13 10:05:00
```

**Rolling Window Visualization**:

```
                    SUPABASE RETENTION
        ◄──────────────────────────────────────►
        Oldest data              Newest data
        (24h ago)                (now)

Day 1:  [Yesterday 10am ──────── Today 10am]
        Payouts: 500

Day 2:  [Yesterday 10am ──────── Today 10am]
        Payouts: 520 (20 new payouts added)

Month later:
        [29 days ago 10am ──── Today 10am]
        Payouts: ~500 (stable, old data deleted)
```

**Storage**: ~500 rows per firm × 10 firms = **5,000 rows** (rolling)

---

## 3. Historical Sync (JSON Files) - Daily 3 AM PST

### 3.1 Trigger & Frequency

**Trigger**: GitHub Actions cron
**Schedule**: Daily at **3 AM PST (11:00 UTC)**
**Location**: [`.github/workflows/sync-firm-payouts-historical.yml:14`](.github/workflows/sync-firm-payouts-historical.yml:14)

```yaml
schedule:
  # 3 AM PST = 11:00 UTC (PST is UTC-8)
  - cron: "0 11 * * *"
```

**⚠️ IMPORTANT**: This is **NOT 3 AM every day in every timezone!**

```
3 AM PST = 11:00 UTC

In different timezones:
- Los Angeles (PST/PDT): 3:00 AM ✅
- Dubai (GST, UTC+4):    3:00 PM 🕒 (afternoon!)
- UTC:                  11:00 AM
```

**Why 3 AM PST?**
- Low traffic time in US (primary market)
- After business day ends in US
- Before Asian markets open

### 3.2 Calendar Month Boundary (Not Rolling!)

**Key Difference from Real-time**: Historical sync uses **calendar month boundaries**, not rolling windows.

```javascript
// scripts/update-monthly-json.js:83-92
function getCurrentYearMonthInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  });
  return formatter.format(now).slice(0, 7); // Returns "YYYY-MM"
}

// Example:
// UTC time: 2025-02-01 11:00:00 (GitHub Actions runs)
// Firm timezone: Asia/Dubai (UTC+4)
// Current month in Dubai: 2025-02-01 15:00 → "2025-02"
```

**What this means**:

```
                HISTORICAL SYNC (CALENDAR MONTH)
        ◄──────────────────────────────────────────►
        Month start              Month end
        (Feb 1 00:00 Dubai)     (Mar 1 00:00 Dubai)

Feb 1:  Sync runs, creates/updates 2025-02.json
        Includes: All transactions from Feb 1 00:00 Dubai onwards

Feb 2:  Sync runs, OVERWRITES 2025-02.json
        Includes: All transactions from Feb 1 00:00 to current time

...

Mar 1:  Sync runs, creates 2025-03.json
        Includes: All transactions from Mar 1 00:00 Dubai onwards
        2025-02.json is now FROZEN (no more updates)
```

**🔴 CRITICAL: Historical sync OVERWRITES files, doesn't append!**

### 3.3 Data Flow (Step-by-Step)

**Step 1: Determine Current Month (Timezone-Aware)**

```javascript
// scripts/update-monthly-json.js:307-309
const timezone = firm.timezone || 'UTC';
const yearMonth = getCurrentYearMonthInTimezone(timezone);

// Example for fundingpips (Dubai, UTC+4):
// GitHub Actions runs: 2025-02-13 11:00 UTC
// Dubai time:          2025-02-13 15:00 GST
// yearMonth:           "2025-02"
```

**Step 2: Fetch ALL Transactions from Arbiscan**

```javascript
// scripts/update-monthly-json.js:317-322
for (const address of firm.addresses) {
  const { native, tokens } = await fetchAllTransactions(address, apiKey);
  allNative = [...allNative, ...native];
  allTokens = [...allTokens, ...tokens];
  await sleep(500); // Rate limit
}

// ⚠️ IMPORTANT: Fetches ALL historical data, no time filter!
// A firm with 10,000 transactions will download all 10,000 every day
```

**Why fetch everything?**

Arbiscan API doesn't support efficient time-range filtering:
- `startblock` and `endblock` params exist but require block number calculation
- Simpler to fetch all and filter client-side (but wasteful!)

**Step 3: Filter to Current Month (Timezone-Aware)**

```javascript
// scripts/update-monthly-json.js:155-218
function processTransactionsForMonth(native, tokens, addresses, firmId, yearMonth, timezone) {
  const payouts = [];

  for (const tx of native) {
    const timestamp = parseInt(tx.timeStamp);
    const isoTimestamp = new Date(timestamp * 1000).toISOString();

    // Convert UTC timestamp to firm's local date
    const txYearMonth = getLocalYearMonth(isoTimestamp, timezone);

    // ✅ FILTER: Only include if transaction month matches target month
    if (txYearMonth !== yearMonth) continue;

    payouts.push({
      tx_hash: tx.hash,
      amount: (parseFloat(tx.value) / 1e18) * PRICES.ETH,
      timestamp: isoTimestamp,
      // ...
    });
  }

  return payouts;
}
```

**Example**:

```
Transaction timestamp (UTC): 2025-02-01 00:30:00
Firm timezone: Asia/Dubai (UTC+4)
Local timestamp: 2025-02-01 04:30:00 GST
Local month: "2025-02" ✅ Included

Transaction timestamp (UTC): 2025-01-31 23:30:00
Firm timezone: Asia/Dubai (UTC+4)
Local timestamp: 2025-02-01 03:30:00 GST
Local month: "2025-02" ✅ ALSO INCLUDED (different from real-time!)
```

**Step 4: Build Daily Buckets (Timezone-Aware)**

```javascript
// scripts/update-monthly-json.js:239-247
for (const t of transactions) {
  const day = getLocalDate(t.timestamp, timezone); // Converts to YYYY-MM-DD in local TZ

  if (!dailyMap[day]) {
    dailyMap[day] = { date: day, total: 0, rise: 0, crypto: 0, wire: 0 };
  }

  dailyMap[day].total += t.amount;
  dailyMap[day][t.payment_method] += t.amount;
}
```

**Result**:
```json
{
  "firmId": "fundingpips",
  "period": "2025-02",
  "timezone": "Asia/Dubai",
  "dailyBuckets": [
    { "date": "2025-02-01", "total": 45000, "rise": 30000, "crypto": 15000 },
    { "date": "2025-02-02", "total": 52000, "rise": 35000, "crypto": 17000 },
    ...
  ]
}
```

**Step 5: Compare with Existing File**

```javascript
// scripts/update-monthly-json.js:344-354
const existing = loadExistingMonthData(firm.id, yearMonth);
const existingCount = existing?.summary?.payoutCount || 0;

if (existingCount === monthData.summary.payoutCount) {
  console.log(`No new payouts (still ${existingCount})`);
  return { firm: firm.id, changed: false }; // ✅ Skip git commit
}

// Otherwise, overwrite file
fs.writeFileSync(filePath, JSON.stringify(monthData, null, 2));
```

**🔴 CRITICAL: File is completely OVERWRITTEN, not incrementally updated!**

**Step 6: Git Commit & Push**

```bash
# .github/workflows/sync-firm-payouts-historical.yml:57-59
git add data/payouts/
git commit -m "chore: update firm payout data 2025-02-13"
git push
```

**Vercel Auto-Deploy**:
```
GitHub push → Vercel webhook → Redeploy site (takes ~2 min)
→ New JSON files available to API routes
```

### 3.4 Month Transition Edge Cases

**Scenario: Sync runs on Feb 1 at 3 AM PST**

```
GitHub Actions: 2025-02-01 11:00 UTC

Firm: fundingpips (Dubai, UTC+4)
Current Dubai time: 2025-02-01 15:00 GST
Current month: "2025-02"

Firm: la-based-firm (LA, UTC-8)
Current LA time: 2025-02-01 03:00 PST
Current month: "2025-02"

Both firms update 2025-02.json ✅
```

**But what about transactions from Jan 31?**

```
Transaction: 2025-01-31 23:00 UTC

For Dubai firm (UTC+4):
  Local time: 2025-02-01 03:00 GST
  Month: "2025-02" → Included in 2025-02.json ✅

For LA firm (UTC-8):
  Local time: 2025-01-31 15:00 PST
  Month: "2025-01" → Included in 2025-01.json ✅

Different firms put same UTC transaction in different month files!
```

**Why is this OK?**

Each firm's business day is relative to their timezone. A Dubai firm's "February 1st business day" starts at midnight Dubai time, even if that's still January 31 in UTC.

**Scenario: What if historical sync runs BEFORE month rollover?**

```
GitHub Actions runs: 2025-01-31 11:00 UTC (still Jan 31 in PST)

Firm: fundingpips (Dubai, UTC+4)
Current Dubai time: 2025-01-31 15:00 GST
Current month: "2025-01" ← Still January in Dubai!

Sync updates: 2025-01.json ✅ Correct
```

But 12 hours later:

```
Real time: 2025-02-01 03:00 Dubai (new month!)
Last sync: 2025-01-31 15:00 Dubai

Transactions between 15:00 yesterday and now are NOT in any file yet!
They'll be picked up in next day's sync (Feb 1 at 3 AM PST = Feb 1 at 15:00 Dubai)
```

**Data freshness**: Historical JSON files can be up to **24 hours stale** (last updated 3 AM yesterday).

---

## 4. Data Overlap Analysis

### 4.1 The Core Problem

**Two independent systems with different cutoffs**:

```
REAL-TIME (Supabase):
  - Cutoff: (NOW - 24 hours) in UTC
  - Updates: Every 5 minutes
  - Timezone: UTC only

HISTORICAL (JSON):
  - Cutoff: Month boundary in firm's local timezone
  - Updates: Daily at 3 AM PST
  - Timezone: Firm-specific (Dubai, LA, etc.)
```

**❌ These DO NOT align!**

### 4.2 Overlap Scenarios

**Scenario 1: Transaction on Feb 1 at 00:30 UTC**

```
Transaction: 2025-02-01 00:30 UTC
Amount: $1,500

Real-time sync at 2025-02-01 12:00 UTC:
  Cutoff: 2025-01-31 12:00 UTC
  Is 00:30 >= 12:00 (yesterday)? NO ❌
  → NOT included in Supabase

Wait, that's wrong! Let me recalculate:
  Transaction: 2025-02-01 00:30 UTC (Unix: 1738368600)
  Cutoff: 2025-01-31 12:00 UTC (Unix: 1738324800)
  Is 1738368600 >= 1738324800? YES ✅
  → Included in Supabase

Historical sync (Dubai firm, UTC+4):
  Transaction local time: 2025-02-01 04:30 GST
  Month: "2025-02"
  → Included in 2025-02.json ✅

RESULT: Transaction in BOTH systems ✅ (correct overlap)
```

**Scenario 2: Transaction on Jan 31 at 23:00 UTC**

```
Transaction: 2025-01-31 23:00 UTC (1 hour before midnight)
Amount: $2,000

Real-time sync at 2025-02-01 12:00 UTC:
  Cutoff: 2025-01-31 12:00 UTC
  Is 23:00 >= 12:00? YES ✅
  → Included in Supabase (24h window)

Historical sync (Dubai firm, UTC+4):
  Transaction local time: 2025-02-01 03:00 GST (next day in Dubai!)
  Month: "2025-02"
  → Included in 2025-02.json ✅

RESULT: Transaction in BOTH systems ✅

But wait, when does it leave Supabase?
  At 2025-02-01 23:00 UTC (24h later), cleanup deletes it
  It's still in 2025-02.json until that file is frozen (Mar 1)

So for 1 hour, transaction is ONLY in JSON file (not in Supabase)
```

**Scenario 3: Sync Failure Creates Gap**

```
Timeline:
2025-02-13 09:55 UTC - Real-time sync #N succeeds
  Cutoff: 2025-02-12 09:55 UTC
  Supabase contains transactions from 09:55 yesterday onwards

2025-02-13 10:00 UTC - Real-time sync #N+1 FAILS (Arbiscan timeout)
  ❌ No update

2025-02-13 10:05 UTC - Real-time sync #N+2 succeeds
  Cutoff: 2025-02-12 10:05 UTC
  Cleanup deletes transactions older than 10:05 yesterday

❌ GAP: Transactions between 09:55 and 10:05 yesterday are DELETED!

But are they in historical JSON?
  If transaction was on 2025-02-12 between 09:55-10:05:
    Historical sync (daily at 11:00 UTC) hasn't run yet
    Transaction will be captured in next historical sync ✅

  If transaction was on 2025-01-12 (1 month ago):
    Historical sync already ran for January
    File is frozen (2025-01.json)
    Transaction is PRESERVED in JSON ✅

VERDICT: Gap only affects CURRENT DAY in real-time, historical catches it!
```

### 4.3 When Data is ONLY in One System

**Case 1: Data ONLY in Supabase (not in JSON)**

This happens for transactions in the **last 24 hours that haven't been picked up by historical sync yet**.

```
Current time: 2025-02-13 09:00 UTC
Last historical sync: 2025-02-13 11:00 UTC yesterday

Transactions from 2025-02-12 11:00 to 2025-02-13 09:00:
  ✅ In Supabase (within 24h window)
  ❌ Not in JSON yet (historical sync runs at 11:00 UTC today)

After 11:00 UTC today:
  ✅ In Supabase
  ✅ In 2025-02.json (updated by historical sync)
```

**Duration**: Up to **24 hours** (between historical syncs)

**Case 2: Data ONLY in JSON (not in Supabase)**

This happens for transactions **older than 24 hours**.

```
Transaction: 2025-02-11 15:00 UTC (2 days ago)

Real-time cutoff: 2025-02-13 09:00 - 24h = 2025-02-12 09:00 UTC
Is 2025-02-11 15:00 >= 2025-02-12 09:00? NO ❌
  → NOT in Supabase (too old)

Historical:
  Month: 2025-02
  ✅ In 2025-02.json (captured by historical sync)
```

**Duration**: Permanent (until month ends and file is frozen)

### 4.4 Overlap Detection Algorithm

**Goal**: Verify that Supabase and JSON data are consistent for the **overlapping period** (last 24 hours of current month).

```javascript
async function validateDataOverlap(firmId, yearMonth) {
  // Step 1: Load JSON file
  const jsonData = loadMonthlyData(firmId, yearMonth);
  const jsonTransactions = jsonData.transactions || [];

  // Step 2: Calculate overlap window
  // (last 24 hours that should be in BOTH systems)
  const now = new Date();
  const cutoff24h = new Date(now - 24 * 60 * 60 * 1000);
  const monthStart = new Date(yearMonth + '-01');

  // Overlap = max(cutoff24h, monthStart) to now
  const overlapStart = cutoff24h > monthStart ? cutoff24h : monthStart;

  // Step 3: Filter JSON transactions to overlap window
  const jsonInOverlap = jsonTransactions.filter(tx => {
    const txDate = new Date(tx.timestamp);
    return txDate >= overlapStart && txDate <= now;
  });

  // Step 4: Query Supabase for same window
  const { data: supabaseData } = await supabase
    .from('recent_payouts')
    .select('tx_hash, amount, timestamp')
    .eq('firm_id', firmId)
    .gte('timestamp', overlapStart.toISOString())
    .lte('timestamp', now.toISOString());

  // Step 5: Compare transaction hashes
  const jsonHashes = new Set(jsonInOverlap.map(tx => tx.tx_hash));
  const supabaseHashes = new Set(supabaseData.map(tx => tx.tx_hash));

  const missingInJson = [...supabaseHashes].filter(h => !jsonHashes.has(h));
  const missingInSupabase = [...jsonHashes].filter(h => !supabaseHashes.has(h));

  return {
    overlapWindow: { start: overlapStart, end: now },
    jsonCount: jsonHashes.size,
    supabaseCount: supabaseHashes.size,
    missingInJson,
    missingInSupabase,
    matchPercentage: (
      (jsonHashes.size + supabaseHashes.size - missingInJson.length - missingInSupabase.length) /
      (jsonHashes.size + supabaseHashes.size)
    ) * 100,
  };
}
```

**Expected Results**:

```javascript
// Perfect overlap
{
  overlapWindow: { start: "2025-02-12T09:00:00Z", end: "2025-02-13T09:00:00Z" },
  jsonCount: 45,
  supabaseCount: 45,
  missingInJson: [],
  missingInSupabase: [],
  matchPercentage: 100
}

// Sync gap detected
{
  overlapWindow: { start: "2025-02-12T09:00:00Z", end: "2025-02-13T09:00:00Z" },
  jsonCount: 45,
  supabaseCount: 42, // 3 transactions missing!
  missingInJson: [],
  missingInSupabase: ["0xabc123", "0xdef456", "0xghi789"],
  matchPercentage: 95.5
}
```

---

## 5. Data Accuracy Guarantees

### 5.1 Real-time (Supabase) Accuracy

**Guarantee Level**: ⚠️ **BEST-EFFORT** (not guaranteed accurate)

**Potential Inaccuracies**:

1. **Sync Failures** (most common)
   - Arbiscan API timeout → missing transactions
   - Network error → incomplete sync
   - Inngest failure → sync skipped

2. **Indexing Lag**
   - Arbiscan indexes transactions ~30s after mining
   - During congestion: up to 5 minutes
   - Race condition: transaction happens, sync runs before indexing

3. **Blockchain Reorgs** (rare)
   - Transaction included in block
   - Block orphaned
   - Transaction may or may not be re-mined

4. **Cleanup Race Condition**
   ```javascript
   // Sync starts at 10:00:00
   const cutoff = now - 24h; // 09:59:59 yesterday

   // Sync completes at 10:00:30
   // Cleanup runs at 10:00:30
   const cleanupCutoff = now - 24h; // 10:00:29 yesterday

   // 30-second gap! Transactions from 09:59:59 to 10:00:29 yesterday deleted
   ```

**Current Mitigation**: ❌ **NONE**

**Recommended Mitigations**:

1. **Track last successful sync**:
   ```javascript
   await supabase
     .from('firms')
     .update({ last_synced_at: new Date().toISOString() })
     .eq('id', firmId);
   ```

2. **Use last_synced_at for cutoff**:
   ```javascript
   const { data: firm } = await supabase
     .from('firms')
     .select('last_synced_at')
     .eq('id', firmId)
     .single();

   const cutoff = firm.last_synced_at
     ? new Date(firm.last_synced_at)
     : new Date(Date.now() - 25 * 60 * 60 * 1000); // Extra 1h buffer
   ```

3. **Verify transaction hashes**:
   ```javascript
   // For critical transactions, verify on Arbiscan
   const tx = await fetchTransaction(tx_hash);
   if (!tx) {
     // Transaction was orphaned, delete from Supabase
     await supabase.from('recent_payouts').delete().eq('tx_hash', tx_hash);
   }
   ```

### 5.2 Historical (JSON) Accuracy

**Guarantee Level**: ✅ **HIGH** (eventually consistent)

**Why more accurate?**

1. **Fetches ALL historical data** (no cutoff risk)
2. **Overwrites file completely** (no partial updates)
3. **Git versioned** (can revert if corrupted)
4. **No cleanup** (data preserved until month ends)

**Potential Inaccuracies**:

1. **Arbiscan Indexing Lag**
   ```
   Sync runs: 2025-02-13 11:00 UTC (3 AM PST)
   Arbiscan still indexing: Transactions from 10:55-11:00 UTC

   These transactions will be picked up in NEXT day's sync ✅
   ```

2. **Timezone Edge Cases**
   ```
   Transaction: 2025-01-31 23:59 UTC
   Firm timezone: UTC+4 (Dubai)
   Local time: 2025-02-01 03:59 GST

   Month: "2025-02" (correct for Dubai business day)
   ```

3. **File Write Failures**
   ```
   - Disk full → write fails
   - Permission error → write fails
   - Git push fails → changes not deployed

   All rare, but possible
   ```

**Current Mitigation**: ✅ **PARTIAL**
- GitHub Actions retries (3 attempts)
- Git commit preserves history
- Vercel auto-deploy on push

**Recommended Mitigations**:

1. **Add checksums**:
   ```json
   {
     "firmId": "fundingpips",
     "period": "2025-02",
     "checksum": "sha256:abc123...",
     "transactions": [...]
   }
   ```

2. **Validate before overwrite**:
   ```javascript
   const existing = loadMonthlyData(firmId, yearMonth);
   const newData = buildMonthData(...);

   // Don't overwrite if new data is SMALLER (possible data loss)
   if (newData.summary.payoutCount < existing.summary.payoutCount * 0.9) {
     throw new Error('New data suspiciously smaller, aborting write');
   }
   ```

3. **Keep backups**:
   ```javascript
   // Before overwrite, backup existing file
   const backupPath = `${filePath}.backup-${Date.now()}`;
   fs.copyFileSync(filePath, backupPath);
   ```

---

## 6. Gap Detection & Resolution

### 6.1 What Gaps to Detect?

1. **Missing Transactions** (most critical)
   - Transaction in Supabase but not in JSON
   - Transaction in JSON but not in Supabase
   - Transaction missing from BOTH (data loss!)

2. **Duplicate Transactions** (should never happen)
   - Same tx_hash appears twice (different amounts)

3. **Metadata Mismatches**
   - Supabase: amount = $1,500
   - JSON: amount = $1,600
   - (Should be identical for same tx_hash)

4. **Stale Data**
   - JSON file last updated >24 hours ago
   - Supabase last_synced_at >10 minutes ago

### 6.2 Detection Strategy

**Daily Validation Script** (run after historical sync):

```javascript
// scripts/validate-data-integrity.js
async function validateAllFirms() {
  const firms = await fetchFirms();
  const issues = [];

  for (const firm of firms) {
    // Validate current month overlap
    const currentMonth = new Date().toISOString().slice(0, 7);
    const overlap = await validateDataOverlap(firm.id, currentMonth);

    if (overlap.matchPercentage < 95) {
      issues.push({
        firmId: firm.id,
        type: 'OVERLAP_MISMATCH',
        severity: 'HIGH',
        details: overlap,
      });
    }

    // Validate previous month (should be frozen)
    const prevMonth = getPreviousMonth(currentMonth);
    const prevOverlap = await validateDataOverlap(firm.id, prevMonth);

    if (prevOverlap.matchPercentage < 99) {
      issues.push({
        firmId: firm.id,
        type: 'HISTORICAL_MISMATCH',
        severity: 'MEDIUM',
        details: prevOverlap,
      });
    }

    // Validate metadata
    const metadataIssues = await validateMetadata(firm.id);
    issues.push(...metadataIssues);
  }

  // Generate report
  if (issues.length > 0) {
    await sendAlert({
      service: 'Data Validation',
      message: `${issues.length} data integrity issues found`,
      severity: issues.some(i => i.severity === 'HIGH') ? 'CRITICAL' : 'WARNING',
      issues,
    });
  }

  return issues;
}
```

**Metadata Validation**:

```javascript
async function validateMetadata(firmId) {
  const issues = [];

  // Check last sync time
  const { data: firm } = await supabase
    .from('firms')
    .select('last_synced_at')
    .eq('id', firmId)
    .single();

  const timeSinceSync = Date.now() - new Date(firm.last_synced_at).getTime();
  if (timeSinceSync > 15 * 60 * 1000) { // >15 min
    issues.push({
      firmId,
      type: 'STALE_SUPABASE',
      severity: 'MEDIUM',
      details: { lastSync: firm.last_synced_at, ageMinutes: timeSinceSync / 60000 },
    });
  }

  // Check JSON file freshness
  const currentMonth = new Date().toISOString().slice(0, 7);
  const jsonData = loadMonthlyData(firmId, currentMonth);

  if (jsonData) {
    const fileAge = Date.now() - new Date(jsonData.generatedAt).getTime();
    if (fileAge > 25 * 60 * 60 * 1000) { // >25 hours
      issues.push({
        firmId,
        type: 'STALE_JSON',
        severity: 'HIGH',
        details: { generatedAt: jsonData.generatedAt, ageHours: fileAge / 3600000 },
      });
    }
  } else {
    issues.push({
      firmId,
      type: 'MISSING_JSON',
      severity: 'CRITICAL',
      details: { month: currentMonth },
    });
  }

  return issues;
}
```

### 6.3 Resolution Procedures

**Issue: Missing Transactions in Supabase**

```
Detection:
  Supabase: 42 transactions
  JSON: 45 transactions
  Missing: 3 transactions

Root Cause: Real-time sync failure between 09:55-10:05 yesterday

Resolution:
  1. Identify missing tx_hashes
  2. Verify they exist on Arbiscan
  3. Manually insert into Supabase:

     const missingTxs = overlap.missingInSupabase;
     for (const txHash of missingTxs) {
       // Fetch from Arbiscan
       const tx = await fetchTransactionByHash(txHash);

       // Insert to Supabase
       await supabase.from('recent_payouts').insert({
         tx_hash: txHash,
         firm_id: firmId,
         amount: tx.amount,
         timestamp: tx.timestamp,
         // ...
       });
     }
```

**Issue: Missing Transactions in JSON**

```
Detection:
  Supabase: 45 transactions
  JSON: 42 transactions
  Missing: 3 transactions

Root Cause: Transactions occurred AFTER historical sync ran

Resolution:
  1. Wait for next historical sync (runs daily at 3 AM PST)
  2. If urgent, trigger manual sync:

     node scripts/update-monthly-json.js --firm fundingpips
     git add data/payouts/fundingpips/2025-02.json
     git commit -m "fix: manual sync for fundingpips"
     git push
```

**Issue: Metadata Mismatch**

```
Detection:
  Supabase tx 0xabc123: amount = $1,500
  JSON tx 0xabc123: amount = $1,600

Root Cause: Price conversion difference (ETH price changed between syncs)

Resolution:
  1. Check which is correct (query Arbiscan directly)
  2. Update incorrect value:

     If Supabase wrong:
       await supabase
         .from('recent_payouts')
         .update({ amount: 1600 })
         .eq('tx_hash', '0xabc123');

     If JSON wrong:
       - Edit JSON file manually
       - Or re-run historical sync
```

---

## 7. Recommended Improvements

### Priority 1: Prevent Sync Gaps (CRITICAL)

**Current Problem**: Sync failures create permanent gaps in 24h data.

**Solution**: Use `last_synced_at` instead of `Date.now()` for cutoff.

```javascript
// lib/services/payoutSyncService.js
async function syncFirmPayouts(firm) {
  const supabase = createServiceClient();

  // NEW: Fetch last successful sync time
  const { data: firmData } = await supabase
    .from('firms')
    .select('last_synced_at')
    .eq('id', firm.id)
    .single();

  // Calculate cutoff with buffer
  let cutoffTime;
  if (firmData.last_synced_at) {
    // Use last sync time, minus 1 hour buffer for safety
    cutoffTime = new Date(firmData.last_synced_at);
    cutoffTime.setHours(cutoffTime.getHours() - 1);
  } else {
    // First sync, go back 25 hours
    cutoffTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
  }

  const cutoff = cutoffTime.getTime() / 1000; // Unix timestamp

  // Rest of sync logic...
  const payouts = processPayouts(nativeData, tokenData, firm.addresses, firm.id, cutoff);

  // Update last_synced_at on SUCCESS
  await supabase
    .from('firms')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', firm.id);
}
```

**Benefits**:
- ✅ No gaps even if sync fails
- ✅ Overlapping data is OK (deduplication via tx_hash)
- ✅ Self-healing (automatically catches up)

**Tradeoff**:
- ⚠️ More data fetched (1 hour overlap)
- ⚠️ Cleanup logic needs update

### Priority 2: Automated Overlap Validation

**Add to GitHub Actions** (runs after historical sync):

```yaml
# .github/workflows/sync-firm-payouts-historical.yml
- name: Validate data integrity
  run: node scripts/validate-data-integrity.js

- name: Send report to Slack
  if: failure()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
      -d '{"text": "❌ Data validation failed - check logs"}'
```

**Weekly Report** (summary of all validations):

```javascript
// Generate weekly summary
{
  week: "2025-W07",
  firms: 10,
  totalValidations: 70,
  issues: {
    overlapMismatch: 2,
    staleData: 1,
    missingTransactions: 0,
  },
  averageMatchPercentage: 99.2,
}
```

### Priority 3: Add Transaction Verification Endpoint

**Purpose**: Verify specific transactions on-demand.

```javascript
// app/api/admin/verify-transaction/route.js
export async function POST(request) {
  const { tx_hash } = await request.json();

  // 1. Check Supabase
  const { data: supabaseTx } = await supabase
    .from('recent_payouts')
    .select('*')
    .eq('tx_hash', tx_hash)
    .single();

  // 2. Check JSON files (search all months)
  const jsonTx = await searchInJSONFiles(tx_hash);

  // 3. Check Arbiscan (source of truth)
  const arbiscanTx = await fetchTransactionByHash(tx_hash);

  return NextResponse.json({
    tx_hash,
    inSupabase: !!supabaseTx,
    inJSON: !!jsonTx,
    onArbiscan: !!arbiscanTx,
    dataMatch: compareTransactions(supabaseTx, jsonTx, arbiscanTx),
  });
}
```

### Priority 4: Checksum Validation for JSON Files

**Add to historical sync**:

```javascript
// scripts/update-monthly-json.js
const crypto = require('crypto');

function calculateChecksum(data) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(data.transactions));
  return hash.digest('hex');
}

// Before writing file
const monthData = buildMonthData(...);
monthData.checksum = calculateChecksum(monthData);

fs.writeFileSync(filePath, JSON.stringify(monthData, null, 2));

// On read, validate checksum
const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const expectedChecksum = calculateChecksum(loaded);

if (loaded.checksum !== expectedChecksum) {
  throw new Error('Checksum mismatch - file corrupted!');
}
```

---

## Summary

### Key Takeaways

1. **Two independent syncs** with different cutoffs = **coordination required**
2. **Real-time accuracy**: ⚠️ Best-effort (gaps possible on failures)
3. **Historical accuracy**: ✅ High (eventually consistent, but 24h lag)
4. **Overlap validation**: ❌ Not currently implemented (critical gap!)
5. **Data freshness**:
   - Supabase: 5 minutes max
   - JSON files: 24 hours max

### Critical Risks

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|------------|
| **Sync failure gaps** | 🔴 HIGH | Lost transactions | Use last_synced_at (PROP-027) |
| **No overlap validation** | 🔴 HIGH | Silent data loss | Daily validation (PROP-018) |
| **Timezone edge cases** | 🟡 MEDIUM | Wrong month bucket | Document + test edge cases |
| **Blockchain reorgs** | 🟢 LOW | Stale tx in DB | Periodic verification (PROP-028) |

### Next Steps

1. **Implement last_synced_at cutoff** (PROP-027) - Week 1
2. **Add daily overlap validation** (PROP-018) - Week 2
3. **Create verification endpoint** (PROP-028) - Week 3
4. **Add file checksums** (PROP-029) - Week 4

All improvements tracked in [tasks.md](./tasks.md).
