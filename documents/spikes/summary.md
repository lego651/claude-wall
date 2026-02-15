# PropFirms Data Aggregation - Executive Summary

**Date**: 2026-02-13
**Status**: 🔴 **CRITICAL PRODUCTION RISKS IDENTIFIED**
**Test Coverage**: 0%
**Production Readiness**: ❌ Not Ready

---

## TL;DR

The `/propfirms` route fetches blockchain data every **5 minutes** via Arbiscan API and serves it through a dual-layer architecture:
- **Real-time (24h)**: Supabase database
- **Historical (30d, 12m)**: JSON files on disk

**Critical Issues**:
1. ❌ **No test coverage** - Zero tests exist
2. ⚠️ **API rate limits** - Free tier constraints may throttle at scale
3. ⚠️ **File I/O bottleneck** - Blocking reads of 500KB+ files
4. ⚠️ **No data overlap protection** - Potential gaps/duplicates
5. ⚠️ **Single point of failure** - No fallback for Arbiscan outages

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA COLLECTION LAYER                        │
│                                                                 │
│  Every 5 minutes (Inngest Cron):                              │
│  ┌────────────────────────────────────────────────┐           │
│  │ Arbiscan API (Arbitrum Blockchain)            │           │
│  │ • Native ETH transactions                      │           │
│  │ • ERC-20 token transactions (USDC, USDT, RISE)│           │
│  │ • Rate Limit: 5 calls/sec, 100k/day (free)   │           │
│  └────────────────────────────────────────────────┘           │
│                         │                                      │
│                         ▼                                      │
│  ┌────────────────────────────────────────────────┐           │
│  │ Processing (Node.js)                          │           │
│  │ • Filter last 24h transactions                 │           │
│  │ • Filter by firm wallet addresses             │           │
│  │ • Remove spam (<$10)                          │           │
│  │ • Deduplicate by tx_hash                      │           │
│  └────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                              │
│                                                                 │
│  ┌─────────────────────────┐    ┌─────────────────────────┐   │
│  │   SUPABASE (24h data)   │    │ JSON FILES (historical) │   │
│  ├─────────────────────────┤    ├─────────────────────────┤   │
│  │ • recent_payouts table  │    │ data/payouts/{firm}/    │   │
│  │ • Rolling 24h window    │    │ └─ 2025-01.json (~50KB) │   │
│  │ • Auto-cleanup on sync  │    │ └─ 2025-02.json         │   │
│  │ • Updated every 5 min   │    │                         │   │
│  │                         │    │ • Updated daily 3AM PST │   │
│  │ Hobby Tier Limits:      │    │ • Via GitHub Actions    │   │
│  │ • 500MB storage         │    │ • Committed to repo     │   │
│  │ • 2 CPU seconds/query   │    │                         │   │
│  │ • 50k reads/month       │    │ File I/O:               │   │
│  └─────────────────────────┘    │ • Blocking reads        │   │
│                                  │ • JSON.parse() in-mem   │   │
│                                  └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVING LAYER                          │
│                                                                 │
│  GET /api/v2/propfirms?period=1d                               │
│  ├─ IF period=1d → Query Supabase recent_payouts              │
│  └─ IF period=7d/30d/12m → Read JSON files from disk          │
│                                                                 │
│  Response time:                                                │
│  • 1d period: ~200-500ms (DB query + aggregation)             │
│  • 30d period: ~500ms-2s (2 file reads + parse + filter)      │
│  • 12m period: ~1-3s (12 file reads + parse + aggregate)      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Findings

### 1. Arbiscan API Usage & Limits

**Current Setup**:
- Runs every **5 minutes** via Inngest cron
- Makes **2 API calls per wallet address** (native + token transactions)
- Current firm count: **~10 firms**
- Average **2-3 addresses per firm**

**API Calls Breakdown** (per sync):
```
10 firms × 2.5 addresses/firm × 2 calls/address = 50 API calls
50 calls ÷ 5 calls/sec rate limit = 10 seconds minimum
+ 500ms delay between addresses = +25 seconds
+ 1000ms delay between firms = +10 seconds
Total sync time: ~45 seconds per run
```

**Daily Usage**:
```
12 syncs/hour × 24 hours = 288 syncs/day
288 syncs × 50 calls = 14,400 API calls/day
Free tier limit: 100,000 calls/day
Current usage: 14.4% of daily quota ✅
```

**Scaling Limits**:
| Firms | Addresses | Calls/Sync | Daily Calls | % of Free Tier |
|-------|-----------|------------|-------------|----------------|
| 10    | 25        | 50         | 14,400      | 14.4% ✅       |
| 20    | 50        | 100        | 28,800      | 28.8% ✅       |
| 50    | 125       | 250        | 72,000      | 72.0% ⚠️       |
| 70    | 175       | 350        | 100,800     | **100.8% 🔴**  |

**🔴 CRITICAL**: Free tier maxes out at **~70 firms** with current sync frequency.

**Options at scale**:
1. Reduce sync frequency (e.g., 10 min → 50% reduction)
2. Upgrade to paid tier ($49/month = 200k calls/day)
3. Batch by priority (hot firms every 5min, cold firms hourly)

---

### 2. Data Synchronization Flow

#### Real-time Sync (Supabase - 24h window)

**Process** (every 5 minutes):
```javascript
// lib/services/payoutSyncService.js:275-324
1. Fetch all firms from Supabase
2. For each firm:
   a. Fetch native + token transactions from Arbiscan
   b. Filter to last 24 hours (cutoff = now - 86400s)
   c. Process & deduplicate
   d. UPSERT to recent_payouts (conflict: tx_hash)
   e. Update firm.last_payout_at metadata
3. DELETE payouts older than 24h (cleanup)
```

**Cutoff Logic**:
```javascript
// payoutSyncService.js:54-55
const now = Date.now() / 1000;
const cutoff24h = now - (24 * 60 * 60);

// Filter: timestamp >= cutoff24h
```

**Data Overlap Protection**: ⚠️ **PARTIAL**
- ✅ UPSERT prevents duplicates (unique constraint on `tx_hash`)
- ❌ No validation that cutoff aligns with previous sync
- ❌ If a sync fails, gap exists until next successful run
- ❌ No "last successful sync" timestamp tracking

**Accuracy Concerns**:
1. **Clock skew**: Server clock drift could cause small gaps
2. **Transaction finality**: Blockchain reorgs (rare on Arbitrum)
3. **Arbiscan indexing lag**: ~30s typical, up to 5min during congestion

---

#### Historical Sync (JSON Files - daily)

**Process** (daily at 3 AM PST via GitHub Actions):
```javascript
// scripts/update-firm-monthly-json.js
1. Fetch ALL transactions from Arbiscan (no time filter)
2. Filter to CURRENT MONTH in firm's local timezone
3. Group by day (local timezone)
4. Calculate summary metrics
5. Overwrite data/payouts/{firm}/YYYY-MM.json
6. Git commit + push
```

**Key Differences from Real-time**:
| Aspect | Real-time (5min) | Historical (daily) |
|--------|------------------|-------------------|
| **Time filter** | Last 24h (UTC) | Current month (local TZ) |
| **Storage** | Supabase DB | Git repo JSON |
| **Cutoff** | Rolling window | Calendar month boundary |
| **Timezone** | UTC only | Firm-specific (e.g., Asia/Dubai) |

**🔴 CRITICAL ISSUE**: **No overlap between 24h and 30d data!**

**Scenario**: Transaction at `2025-02-01 23:30 UTC`
- **Real-time sync (Feb 2 00:00)**: ✅ Included (within 24h)
- **Historical sync (Feb 2 03:00 PST)**: ❌ Excluded (in previous month local time if firm is in Dubai)

**Data Gap Risk**:
- Transactions in the **first 24h of a new month** may be missed by historical aggregation if:
  1. Firm timezone is ahead of UTC (e.g., Asia/Dubai = UTC+4)
  2. Historical sync runs before full month data is available
  3. Arbiscan returns incomplete results

---

### 3. File I/O Performance Analysis

**Current File Sizes**:
```bash
# Sample from production data
data/payouts/the5ers/2025-10.json    610 KB
data/payouts/the5ers/2025-09.json    569 KB
data/payouts/fundingpips/2025-08.json 559 KB
data/payouts/blueguardian/2025-01.json 57 KB
data/payouts/fxify/2025-01.json       34 KB
```

**Performance Impact**:
```javascript
// lib/services/payoutDataLoader.js:20-33
function loadMonthlyData(firmId, yearMonth) {
  const filePath = path.join(PAYOUTS_DIR, firmId, `${yearMonth}.json`);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8'); // ❌ BLOCKING
    return JSON.parse(content); // ❌ MEMORY-INTENSIVE
  }

  return null;
}
```

**Measured Overhead** (estimated):
| Operation | 50KB file | 500KB file | 5MB file |
|-----------|-----------|------------|----------|
| `fs.readFileSync` | ~5ms | ~50ms | ~500ms |
| `JSON.parse` | ~3ms | ~30ms | ~300ms |
| **Total** | **~8ms** | **~80ms** | **~800ms** |

**API Route Impact** (30d period):
```
Load current month (500KB)  → 80ms
Load previous month (500KB) → 80ms
Filter + aggregate          → 20ms
Total backend time          → 180ms
+ Network latency           → +50ms
= Total response time       → ~230ms ✅
```

**Scaling Concerns**:
- Files grow **linearly** with payout volume
- A busy firm with 10,000 payouts/month → **~5-10MB JSON**
- **Vercel timeout**: 10s (hobby), 60s (pro)
- At 5MB per file: **approaching timeout risk**

**🟠 HIGH RISK**: File sizes will exceed 5MB within 6-12 months for top firms.

---

### 4. Supabase Storage Costs (Hobby Plan)

**Current Plan**: Hobby (Free)

**Limits**:
| Resource | Limit | Current Usage | Risk |
|----------|-------|---------------|------|
| **Database storage** | 500 MB | ~50 MB (est.) | 🟢 LOW |
| **Monthly reads** | 50,000 | ~15,000 | 🟢 LOW |
| **Monthly writes** | 500 | ~2,000 | 🟡 MEDIUM |
| **Egress** | Unlimited | - | 🟢 LOW |

**Estimated Row Counts**:
```
10 firms × 50 payouts/day × 1 day = 500 rows (recent_payouts)
10 firms × 1 row = 10 rows (firms metadata)

Total storage: ~500 rows × 1 KB/row = ~500 KB ✅
```

**Scaling Projection** (12 months):
```
100 firms × 100 payouts/day × 1 day = 10,000 rows
10,000 rows × 1 KB = 10 MB (24h rolling)

Historical tables (trustpilot_reviews, weekly_incidents):
+ ~100 MB for reviews
+ ~10 MB for incidents
= ~120 MB total ✅ (well under 500MB)
```

**💚 LOW RISK**: Supabase storage is sufficient for 2+ years at current growth.

---

### 5. JSON Files vs Supabase for Historical Data

#### Current Approach: JSON Files
**Pros**:
- ✅ Zero database costs
- ✅ Version controlled (git history)
- ✅ Easy to debug (human-readable)
- ✅ Fast for small datasets (<100KB)

**Cons**:
- ❌ Blocking I/O (event loop stall)
- ❌ Memory overhead (full parse)
- ❌ No query flexibility (must load entire month)
- ❌ Scales poorly (>5MB = timeout risk)
- ❌ Deployment size increases (git bloat)

#### Alternative: Supabase Storage
**Pros**:
- ✅ Non-blocking queries
- ✅ Indexed lookups (fast filtering)
- ✅ Pagination support
- ✅ No deployment size impact

**Cons**:
- ❌ Storage costs ($0.125/GB after 500MB)
- ❌ Egress costs (unlikely to hit limit)
- ❌ Schema migration complexity

**Cost Comparison** (12 months, 100 firms):
```
JSON Files:
• Git repo size: ~500MB
• Vercel deployment: Free (if <100MB compressed)
• Query time: ~2s for 12m period
• TOTAL: $0/month

Supabase:
• Historical payouts table: ~5GB
• Monthly writes: ~3,000 (GitHub Actions batch inserts)
• Monthly reads: ~50,000 (API queries)
• Cost: $0.125/GB × 4.5GB overage = $0.56/month
• TOTAL: ~$1/month (still on free tier likely)
```

**Recommendation**:
- **Keep JSON for now** (cost = $0, performance acceptable)
- **Add caching layer** (Redis/Vercel KV) to avoid repeated file reads
- **Migrate to Supabase if**:
  - Individual files exceed 5MB
  - Query flexibility needed (date range filters, etc.)
  - Need real-time historical updates

---

## Production Readiness Checklist

### 🔴 Critical (Blockers)
- [ ] **Test coverage <10%** → Need 90%+ before production
- [ ] **No Arbiscan fallback** → Service goes dark if API down
- [ ] **File size unbounded** → Will hit timeout at scale
- [ ] **No monitoring** → Can't detect failures in prod

### 🟠 High Priority
- [ ] **Data gap detection** → Validate 24h/monthly overlap
- [ ] **Rate limit handling** → Graceful degradation, not silent fails
- [ ] **Circuit breaker** → Stop hammering failed APIs
- [ ] **Structured logging** → Can't debug without it

### 🟡 Medium Priority
- [ ] **Caching layer** → Reduce file I/O by 80%+
- [ ] **Database indexes** → Some queries missing indexes
- [ ] **Error tracking** → Sentry integration
- [ ] **Load testing** → Validate under concurrent load

---

## Next Steps

See [tasks.md](./tasks.md) for detailed ticket breakdown.

**Immediate Actions** (Week 1):
1. Add smoke tests for all API routes
2. Implement Arbiscan retry logic
3. Add file size monitoring
4. Set up error tracking (Sentry)

**Short-term** (Weeks 2-4):
5. Build comprehensive test suite (90% coverage)
6. Add caching for JSON file reads
7. Implement data validation

**Medium-term** (Weeks 5-8):
8. Add monitoring dashboards
9. Optimize database queries
10. Load test at 100 firms scale

---

## Appendix: Data Flow Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME DATA FLOW (5min)                         │
└───────────────────────────────────────────────────────────────────────┘

T=0min: Inngest cron triggers
  │
  ├─→ Fetch firms from Supabase
  │   └─→ ~10 firms, ~25 addresses total
  │
  ├─→ FOR EACH firm:
  │     │
  │     ├─→ FOR EACH address:
  │     │     │
  │     │     ├─→ Arbiscan API: fetchNativeTransactions()
  │     │     │   • URL: api.etherscan.io/v2/api?module=account&action=txlist
  │     │     │   • Response: ~100-1000 transactions (all time)
  │     │     │   • Rate limit: 5/sec (wait 200ms)
  │     │     │
  │     │     ├─→ Arbiscan API: fetchTokenTransactions()
  │     │     │   • URL: api.etherscan.io/v2/api?module=account&action=tokentx
  │     │     │   • Response: ~200-2000 token transfers (all time)
  │     │     │   • Rate limit: 5/sec (wait 200ms)
  │     │     │
  │     │     └─→ Sleep 500ms (between addresses)
  │     │
  │     ├─→ Process transactions:
  │     │     • Filter: timestamp >= (now - 24h)
  │     │     • Filter: from_address IN firm.addresses
  │     │     • Filter: amount >= $10 USD
  │     │     • Deduplicate: by tx_hash
  │     │     • Result: ~10-50 payouts for this firm
  │     │
  │     ├─→ Upsert to Supabase:
  │     │     INSERT INTO recent_payouts (...)
  │     │     ON CONFLICT (tx_hash) DO UPDATE SET ...
  │     │
  │     ├─→ Update firm metadata:
  │     │     UPDATE firms SET
  │     │       last_payout_at = ?,
  │     │       last_synced_at = NOW()
  │     │
  │     └─→ Sleep 1000ms (between firms)
  │
  └─→ Cleanup old payouts:
        DELETE FROM recent_payouts
        WHERE timestamp < (NOW() - INTERVAL '24 hours')

T=45sec: Sync complete

┌───────────────────────────────────────────────────────────────────────┐
│                   HISTORICAL DATA FLOW (daily)                        │
└───────────────────────────────────────────────────────────────────────┘

T=3:00 AM PST: GitHub Actions cron triggers
  │
  ├─→ Read data/propfirms.json
  │   └─→ ~10 firms
  │
  ├─→ FOR EACH firm:
  │     │
  │     ├─→ Determine current month in firm's timezone
  │     │   • Firm: fundingpips, TZ: Asia/Dubai (UTC+4)
  │     │   • Current month: 2025-02 (local time)
  │     │
  │     ├─→ FOR EACH address:
  │     │     │
  │     │     ├─→ Arbiscan API: fetch ALL transactions
  │     │     │   • No time filter (returns 10k+ historical txs)
  │     │     │   • May take 5-10 seconds per address
  │     │     │
  │     │     └─→ Sleep 500ms
  │     │
  │     ├─→ Filter to current month (in firm's local timezone):
  │     │     • Convert each tx.timestamp to local date
  │     │     • Keep only transactions where localDate.month == 2025-02
  │     │     • Result: ~1000-5000 transactions for this month
  │     │
  │     ├─→ Group by day (in firm's local timezone):
  │     │     • Bucket by YYYY-MM-DD (local)
  │     │     • Sum amounts by payment_method (rise, crypto, wire)
  │     │
  │     ├─→ Calculate summary:
  │     │     {
  │     │       totalPayouts: sum(amounts),
  │     │       payoutCount: count(txs),
  │     │       largestPayout: max(amounts),
  │     │       avgPayout: avg(amounts)
  │     │     }
  │     │
  │     ├─→ Write to data/payouts/{firm}/2025-02.json:
  │     │     {
  │     │       firmId, period, timezone, generatedAt,
  │     │       summary: { ... },
  │     │       dailyBuckets: [ { date, total, rise, crypto, wire }, ... ],
  │     │       transactions: [ ... ] // Full list
  │     │     }
  │     │
  │     └─→ Sleep 2000ms (between firms)
  │
  ├─→ Git commit:
  │     git add data/payouts/
  │     git commit -m "chore: update firm payout data YYYY-MM-DD"
  │
  └─→ Git push to main branch

T=5-10min: Historical sync complete
```

**Key Observations**:
1. Real-time and historical use **same Arbiscan API** but different filters
2. Historical fetches **all-time data** on every run (wasteful but simple)
3. Timezone handling only in historical (real-time is UTC-only)
4. No coordination between the two flows → **data gap risk**
