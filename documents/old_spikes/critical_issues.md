# Critical Issues Review

This document outlines critical technical issues identified in the current payout data architecture, including data consistency, performance, reliability, and security concerns.

---

## 1. Race Condition Between Real-time & Historical Data

```ts
summary.latestPayoutAt = firm.last_payout_at; // From Supabase (live)
summary.totalPayouts = historicalData.summary.totalPayouts; // From JSON (stale)
```

**Problem**
The `/chart` endpoint merges real-time data (`last_payout_at` from Supabase) with historical JSON summary data.

**Issue**
If a payout occurs between the daily JSON generation and a user’s visit:

* `latestPayoutAt` appears fresh
* Aggregated metrics (charts, totals) are stale

**Impact**
Users may see **“Updated 5 minutes ago”**, but the chart does not include that payout — undermining trust.

---

## 2. Timezone Inconsistency

In `scripts/update-firm-monthly-json.js:56`:

```ts
function getLocalDate(utcTimestamp, timezone) {
  // Converts to firm's local timezone
}
```

**Problem**
Timezone-aware grouping exists, but the timezone source is unclear.

**Missing from**:

* `data/propfirms.json`
* Supabase `firms` table schema
* API responses

**Issue**
If firms operate in different timezones but code defaults to UTC:

* Daily buckets may not align with the firm’s business day
* Day-based analytics become inaccurate

---

## 3. No Data Freshness Indicator

JSON files include a `generatedAt` timestamp, but the API strips it out.

```ts
// payoutDataLoader.js
return {
  summary,
  dailyBuckets,
  transactions
  // Missing: generatedAt, dataVersion, etc.
}
```

**Issue**
The frontend cannot distinguish whether data is:

* 1 hour old
* 12 hours old
* 23 hours old

**Impact**
Users lack transparency on data freshness, which is critical for financial metrics.

---

## 4. Incomplete Error Handling

In `app/api/v2/propfirms/route.js:72`:

```ts
for (const firm of firms) {
  if (period === '1d') {
    const { data: payouts } = await supabase
      .from('recent_payouts')
      .select('amount')
      .eq('firm_id', firm.id)
      // No error handling
  } else {
    const historicalData = loadPeriodData(firm.id, period);
    // What if this is null or undefined?
  }
}
```

**Issue**

* A single Supabase or file-read failure crashes the entire request
* No per-firm fault isolation

**Impact**

* One bad firm = entire list endpoint fails
* Poor resiliency

---

## 5. N+1 Query Problem

```ts
for (const firm of firms) {
  const { data: payouts } = await supabase
    .from('recent_payouts')
    .select('amount')
    .eq('firm_id', firm.id)
    .gte('timestamp', cutoffDate);
}
```

**Issue**

* One database query per firm
* Queries are executed sequentially

**Expected Impact**

* 10 firms → ~10x slower
* 100 firms → unacceptable latency

**Recommended**

* Batch queries using `IN (firm_id1, firm_id2, ...)`
* Group results in memory

---

## 6. Stale Data in Git

Daily JSON updates are committed directly to Git:

```bash
git add data/payouts/
git commit -m "chore: update payout data $(date)"
git push
```

**Issues**

* **Git bloat**: Large files (≈375KB each) committed daily
* **No rollback strategy**: Bad data is hard to detect and revert
* **Deployment lag**: Vercel deploy takes 2–5 minutes → stale data window

---

## 7. Missing Caching Strategy

```ts
export function loadMonthlyData(firmId, yearMonth) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}
```

**Issue**

* Disk read on every request
* JSON parsing on every request
* No in-memory caching

**Typical Impact**

* 5–10ms per file read
* 12 months = 60–120ms overhead per request

---

## 8. Data Type Inconsistencies

```ts
const allTransactions = [];
if (prevData?.transactions) {
  allTransactions.push(
    ...prevData.transactions.filter(
      t => t.timestamp >= cutoffDate.toISOString()
    )
  );
}
```

**Issue**

* Assumes `transactions` is always a valid array
* No schema or type validation
* Malformed JSON can silently break logic

---

## 9. Incomplete Top Payouts Logic

```ts
const payouts = getTopPayoutsFromFiles(firmId, period, 5000)
  .filter(p => p.paymentMethod === 'rise') // Only Rise payouts
  .slice(0, 10);
```

**Issue**

* UI displays **“Top 10 Largest Payouts”**
* Backend silently filters to **Rise payments only**

**Open Questions**

* Why exclude crypto / wire payouts?
* Should the UI explicitly label this filter?
* Is this a temporary technical limitation or business rule?

---

## 10. No Rate Limiting on Arbiscan API

```ts
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);
    await sleep(2000);
  }
}
```

**Issue**

* No exponential backoff
* No API-key-level rate tracking
* No graceful degradation if API is unavailable

**Risk**

* Arbiscan free tier rate limits are common
* Can cause cascading failures during sync

---

## 11. Security: No API Protection

Frontend calls public APIs directly:

```ts
fetch(`/api/v2/propfirms?period=${period}`)
```

**Issues**

* No authentication
* No IP-based rate limiting
* No CORS restrictions
* No request signing

**Risk**

* API can be scraped or abused
* Scaling will significantly increase infra cost

---

## 12. Data Integrity: No Validation or Checksums

JSON pipeline:

1. Script generates files
2. Files committed to Git
3. Deployed to production

**Missing**

* Checksum validation
* Schema validation
* Corruption detection

**Failure Scenario**

* Script crashes mid-write
* Partial JSON committed
* Frontend breaks or shows incorrect data

---

## Summary

These issues collectively impact:

* **Data correctness**
* **User trust**
* **Performance**
* **Scalability**
* **Operational safety**

Addressing them early will significantly improve system robustness and credibility.

---

If you want, next steps could be:

* ✅ A **prioritized fix roadmap**
* ✅ **Quick wins vs long-term refactors**
* ✅ A **target architecture proposal** (Supabase-first, JSON-only, or hybrid)

Just tell me how far you want to go.
