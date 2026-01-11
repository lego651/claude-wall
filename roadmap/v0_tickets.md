# PropVerified v0 - Simplified Tickets

## Total: 10 tickets (~12-16 hours / 2-3 days)

---

## Day 1: API Development (6 hours)

### TICKET-001: Environment Setup
**Priority:** P0
**Estimate:** 30 mins

**Tasks:**
- [ ] Sign up for Arbiscan API key at https://arbiscan.io/apis
- [ ] Add to `.env.local`:
  ```
  ARBISCAN_API_KEY=your_key_here
  NEXT_PUBLIC_TEST_WALLET_ADDRESS=0x1C969652D758f8Fc23C443758f8911086F676216
  ```
- [ ] Update `.env.example` with these variables
- [ ] Test API key with a simple curl request

**Done when:** Can make successful Arbiscan API call

---

### TICKET-002: Create Arbiscan API Helper
**Priority:** P0
**Estimate:** 2 hours

**File:** `lib/arbiscan.js`

**Tasks:**
- [ ] Create `fetchNativeTransactions(address, apiKey)` function
  - Endpoint: `https://api.arbiscan.io/api?module=account&action=txlist&address={address}&sort=desc&apikey={apiKey}`
  - Parse response, extract: hash, timeStamp, from, to, value, blockNumber
- [ ] Create `fetchTokenTransactions(address, apiKey)` function
  - Endpoint: `https://api.arbiscan.io/api?module=account&action=tokentx&address={address}&sort=desc&apikey={apiKey}`
  - Parse response, extract: hash, timeStamp, from, to, value, tokenSymbol, tokenDecimal
- [ ] **No error handling** - let errors bubble up
- [ ] Add console.log for debugging

**Done when:** Both functions return raw transaction arrays from Arbiscan

**Code template:**
```javascript
export async function fetchNativeTransactions(address, apiKey) {
  const url = `https://api.arbiscan.io/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log('Native txs:', data.result?.length || 0);
  return data.result || [];
}

export async function fetchTokenTransactions(address, apiKey) {
  const url = `https://api.arbiscan.io/api?module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log('Token txs:', data.result?.length || 0);
  return data.result || [];
}
```

---

### TICKET-003: Create Transaction Processor
**Priority:** P0
**Estimate:** 2 hours

**File:** `lib/transactionProcessor.js`

**Tasks:**
- [ ] Create constant price object:
  ```javascript
  const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00 };
  ```
- [ ] Create `convertToUSD(amount, token)` function
- [ ] Create `processTransactions(nativeData, tokenData, targetAddress)`:
  - Merge both arrays
  - Filter: only incoming (to === targetAddress)
  - Convert to USD
  - Filter: only >= $10 USD
  - Sort by timestamp (descending)
  - Format fields: fromShort, arbiscanUrl, etc.
  - Limit to 100 transactions
- [ ] Create `calculateStats(transactions)`:
  - totalTransactions
  - totalPayoutUSD
  - last30DaysPayoutUSD (filter by timestamp)
  - last30DaysCount
  - avgPayoutUSD
- [ ] Create `groupByMonth(transactions)` for chart data (last 6 months)

**Done when:** Functions process raw Arbiscan data into clean format

**Code template:**
```javascript
const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00 };

export function convertToUSD(amount, token) {
  return amount * (PRICES[token] || 0);
}

export function processTransactions(nativeData, tokenData, targetAddress) {
  // Normalize native ETH transactions
  const nativeTxs = nativeData
    .filter(tx => tx.to.toLowerCase() === targetAddress.toLowerCase())
    .map(tx => ({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / 1e18, // Wei to ETH
      token: 'ETH',
      blockNumber: parseInt(tx.blockNumber)
    }));

  // Normalize ERC-20 token transactions
  const tokenTxs = tokenData
    .filter(tx => tx.to.toLowerCase() === targetAddress.toLowerCase())
    .filter(tx => ['USDC', 'USDT'].includes(tx.tokenSymbol))
    .map(tx => ({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
      token: tx.tokenSymbol,
      blockNumber: parseInt(tx.blockNumber)
    }));

  // Merge and process
  const allTxs = [...nativeTxs, ...tokenTxs]
    .map(tx => ({
      ...tx,
      amountUSD: convertToUSD(tx.amount, tx.token),
      date: new Date(tx.timestamp * 1000).toISOString(),
      fromShort: `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
      arbiscanUrl: `https://arbiscan.io/tx/${tx.txHash}`
    }))
    .filter(tx => tx.amountUSD >= 10) // Filter < $10
    .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
    .slice(0, 100); // Limit to 100

  return allTxs;
}

export function calculateStats(transactions) {
  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

  const totalPayoutUSD = transactions.reduce((sum, tx) => sum + tx.amountUSD, 0);
  const last30DaysTxs = transactions.filter(tx => tx.timestamp >= thirtyDaysAgo);
  const last30DaysPayoutUSD = last30DaysTxs.reduce((sum, tx) => sum + tx.amountUSD, 0);

  return {
    totalTransactions: transactions.length,
    totalPayoutUSD: Math.round(totalPayoutUSD * 100) / 100,
    last30DaysPayoutUSD: Math.round(last30DaysPayoutUSD * 100) / 100,
    last30DaysCount: last30DaysTxs.length,
    avgPayoutUSD: transactions.length > 0 ? Math.round((totalPayoutUSD / transactions.length) * 100) / 100 : 0
  };
}

export function groupByMonth(transactions) {
  // Group transactions by month for last 6 months
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const monthlyData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = months[d.getMonth()];
    const monthStart = d.getTime() / 1000;
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime() / 1000;

    const monthTxs = transactions.filter(tx => tx.timestamp >= monthStart && tx.timestamp <= monthEnd);
    const amount = monthTxs.reduce((sum, tx) => sum + tx.amountUSD, 0);

    monthlyData.push({ month: monthName, amount: Math.round(amount) });
  }

  return monthlyData;
}
```

---

### TICKET-004: Create API Route
**Priority:** P0
**Estimate:** 1.5 hours

**File:** `app/api/transactions/route.js`

**Tasks:**
- [ ] Create GET handler
- [ ] Get `address` from query params
- [ ] Call `fetchNativeTransactions()` and `fetchTokenTransactions()`
- [ ] Process with `processTransactions()`
- [ ] Calculate stats with `calculateStats()`
- [ ] Generate monthly data with `groupByMonth()`
- [ ] Return JSON response
- [ ] **No caching, no complex error handling** - keep it simple

**Done when:** Endpoint returns correct JSON structure

**Code template:**
```javascript
import { NextResponse } from 'next/server';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';
import { processTransactions, calculateStats, groupByMonth } from '@/lib/transactionProcessor';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Arbiscan API key not configured' }, { status: 500 });
  }

  // Fetch data from Arbiscan
  const nativeData = await fetchNativeTransactions(address, apiKey);
  const tokenData = await fetchTokenTransactions(address, apiKey);

  // Process transactions
  const transactions = processTransactions(nativeData, tokenData, address);
  const stats = calculateStats(transactions);
  const monthlyData = groupByMonth(transactions);

  return NextResponse.json({
    address,
    ...stats,
    transactions,
    monthlyData
  });
}
```

---

## Day 2: Frontend Integration (4.5 hours)

### TICKET-005: Create React Hook
**Priority:** P1
**Estimate:** 1 hour

**File:** `lib/hooks/useTransactions.js`

**Tasks:**
- [ ] Create `useTransactions(address)` hook
- [ ] Use `useState` for `{ data, loading, error }`
- [ ] Use `useEffect` to fetch on mount
- [ ] **No retry, no caching** - simple fetch

**Done when:** Hook returns data, loading, error states

**Code template:**
```javascript
"use client";
import { useState, useEffect } from 'react';

export function useTransactions(address) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;

    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/transactions?address=${address}`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        const json = await response.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [address]);

  return { data, loading, error };
}
```

---

### TICKET-006: Update Profile - Stats Cards
**Priority:** P1
**Estimate:** 1 hour

**File:** `app/trader/[handle]/page.js`

**Tasks:**
- [ ] Add `const TEST_WALLET = process.env.NEXT_PUBLIC_TEST_WALLET_ADDRESS;` at top
- [ ] Import `useTransactions` hook
- [ ] Call hook: `const { data, loading, error } = useTransactions(TEST_WALLET);`
- [ ] Replace mock data in three stat cards:
  - Total Verified → `data?.totalPayoutUSD`
  - Last 30 Days → `data?.last30DaysPayoutUSD`
  - Avg Payout → `data?.avgPayoutUSD`
- [ ] Show "Loading..." when `loading === true`
- [ ] Show error message if `error`

**Done when:** Stat cards display real data

---

### TICKET-007: Update Profile - Transaction Table
**Priority:** P1
**Estimate:** 1.5 hours

**File:** `app/trader/[handle]/page.js`

**Tasks:**
- [ ] Replace mock `payouts` array with `data?.transactions`
- [ ] Update table columns:
  - Date: `new Date(tx.timestamp * 1000).toLocaleDateString()`
  - From: Remove "Firm" column, show `tx.fromShort`
  - Tx Hash: Show shortened hash with link to `tx.arbiscanUrl`
  - Amount: `$${tx.amountUSD.toLocaleString()}`
- [ ] Handle loading state (show skeleton rows)
- [ ] Handle empty state (no transactions)

**Done when:** Table shows real transactions with Arbiscan links

---

### TICKET-008: Update Profile - Monthly Chart
**Priority:** P1
**Estimate:** 1 hour

**File:** `app/trader/[handle]/page.js`

**Tasks:**
- [ ] Replace mock `chartData` with `data?.monthlyData`
- [ ] Verify Recharts renders correctly
- [ ] Handle loading state for chart
- [ ] Verify tooltip shows correct USD values

**Done when:** Chart displays real monthly payout data

---

## Day 3: Testing & Cleanup (3 hours)

### TICKET-009: Manual Testing
**Priority:** P0
**Estimate:** 2 hours

**Tasks:**
- [ ] Test API endpoint directly in browser: `/api/transactions?address=0x1C969652D758f8Fc23C443758f8911086F676216`
- [ ] Verify JSON response structure is correct
- [ ] Visit trader profile page: `/trader/thefundedlady`
- [ ] Verify stats cards show real data
- [ ] Verify transaction table loads
- [ ] Click Arbiscan links → verify they open correct transaction
- [ ] Verify monthly chart renders
- [ ] Compare 3-5 transactions with Arbiscan manually to verify accuracy
- [ ] Test loading states (throttle network in DevTools)
- [ ] Test error states (use invalid address)

**Done when:** All features work, no critical bugs

---

### TICKET-010: Code Cleanup & Documentation
**Priority:** P1
**Estimate:** 1 hour

**Tasks:**
- [ ] Remove unnecessary console.logs (keep only important ones)
- [ ] Add comments to key functions
- [ ] Verify `.env.example` has all required variables
- [ ] Run `npm run lint` and fix critical issues (ignore warnings)
- [ ] Run `npm run build` and verify it succeeds
- [ ] Update `README.md` with setup instructions (optional)
- [ ] Add TODO comments for Phase 1 improvements:
  ```javascript
  // TODO (Phase 1): Replace with historical prices from CoinGecko
  const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00 };
  ```

**Done when:** Code is clean, builds successfully, ready to demo

---

## Summary

### Total Effort: 12-16 hours (2-3 days)
- **Day 1 (API):** 6 hours
- **Day 2 (Frontend):** 4.5 hours
- **Day 3 (Testing):** 3 hours

### Critical Path:
TICKET-001 → TICKET-002 → TICKET-003 → TICKET-004 → TICKET-005 → TICKET-006/007/008 → TICKET-009 → TICKET-010

### Parallel Work:
- TICKET-006, 007, 008 can be done in parallel once TICKET-005 is complete

### Definition of Done:
- ✅ API fetches real transactions from Arbiscan
- ✅ Trader profile shows real data (stats, table, chart)
- ✅ Links to Arbiscan work correctly
- ✅ No critical console errors
- ✅ `npm run build` succeeds
- ✅ Team can demo and verify data manually

---

## Technical Debt Reminders

Add these TODO comments in code:

```javascript
// TODO (Phase 1): Implement historical USD prices via CoinGecko API
// TODO (Phase 1): Add 5-minute caching to reduce Arbiscan API calls
// TODO (Phase 1): Implement retry logic and better error handling
// TODO (Phase 1): Handle rate limiting gracefully
```
