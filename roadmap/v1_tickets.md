# PropVerified v1 - Tickets (Prop Firm Analytics - SIMPLIFIED)

## Total: 7 tickets (~12-14 hours / 2-3 days)

---

## Day 1: API Development (4-5 hours)

### TICKET-V1-001: Update Transaction Processor for Outgoing Txs
**Priority:** P0
**Estimate:** 2 hours

**File:** `lib/transactionProcessor.js` (UPDATE existing file)

**Tasks:**
- [ ] Create new function `processOutgoingTransactions(nativeData, tokenData, sourceAddresses, days)`:
  - Filter for **outgoing** transactions (`from === sourceAddress`)
  - Support **multiple source addresses** (array)
  - Filter by **time range** (last N days)
  - Merge and format similar to v0
  - Sort by timestamp descending
- [ ] Create `calculatePropFirmStats(transactions)`:
  - totalPayoutUSD
  - totalPayoutCount
  - largestPayoutUSD (use Math.max)
  - timeSinceLastPayout (calculate from most recent tx)
- [ ] Create `groupByDay(transactions, days = 7)`:
  - Group transactions by day
  - Return array of { date, totalUSD, rise, crypto, wireTransfer }
  - For v1, set all to "crypto" (placeholder)
- [ ] Create helper `calculateTimeSince(timestamp)`:
  - Return human-readable string like "4hr 8min"

**Done when:** Functions process outgoing transactions correctly for multiple addresses

**Code template:**
```javascript
export function processOutgoingTransactions(nativeData, tokenData, sourceAddresses, days = 7) {
  const now = Date.now() / 1000;
  const cutoffTime = now - (days * 24 * 60 * 60);
  const lowerSourceAddrs = sourceAddresses.map(a => a.toLowerCase());

  // Filter outgoing native ETH transactions
  const nativeTxs = nativeData
    .filter(tx => lowerSourceAddrs.includes(tx.from.toLowerCase()))
    .filter(tx => parseInt(tx.timeStamp) >= cutoffTime)
    .map(tx => ({
      txHash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from,
      to: tx.to,
      amount: parseFloat(tx.value) / 1e18,
      token: 'ETH',
      blockNumber: parseInt(tx.blockNumber)
    }));

  // Filter outgoing ERC-20 token transactions
  const tokenTxs = tokenData
    .filter(tx => lowerSourceAddrs.includes(tx.from.toLowerCase()))
    .filter(tx => parseInt(tx.timeStamp) >= cutoffTime)
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
      toShort: `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`,
      fromShort: `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`,
      arbiscanUrl: `https://arbiscan.io/tx/${tx.txHash}`,
      paymentMethod: 'Crypto' // Placeholder
    }))
    .filter(tx => tx.amountUSD >= 10)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 100);

  return allTxs;
}

export function calculatePropFirmStats(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      totalPayoutUSD: 0,
      totalPayoutCount: 0,
      largestPayoutUSD: 0,
      timeSinceLastPayout: 'N/A'
    };
  }

  const totalPayoutUSD = transactions.reduce((sum, tx) => sum + tx.amountUSD, 0);
  const largestPayoutUSD = Math.max(...transactions.map(tx => tx.amountUSD));
  const mostRecentTx = transactions[0]; // Already sorted desc

  return {
    totalPayoutUSD: Math.round(totalPayoutUSD * 100) / 100,
    totalPayoutCount: transactions.length,
    largestPayoutUSD: Math.round(largestPayoutUSD * 100) / 100,
    timeSinceLastPayout: calculateTimeSince(mostRecentTx.timestamp)
  };
}

export function groupByDay(transactions, days = 7) {
  const now = new Date();
  const dailyData = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);

    const dayStart = d.getTime() / 1000;
    const dayEnd = dayStart + (24 * 60 * 60);

    const dayTxs = transactions.filter(tx =>
      tx.timestamp >= dayStart && tx.timestamp < dayEnd
    );

    const totalUSD = dayTxs.reduce((sum, tx) => sum + tx.amountUSD, 0);

    dailyData.push({
      date: d.toISOString().split('T')[0],
      totalUSD: Math.round(totalUSD),
      crypto: Math.round(totalUSD), // Placeholder - all crypto for now
      rise: 0,
      wireTransfer: 0
    });
  }

  return dailyData;
}

export function calculateTimeSince(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}hr`;
  }

  return `${hours}hr ${minutes}min`;
}
```

---

### TICKET-V1-002: Create Prop Firm Transactions API Endpoint
**Priority:** P0
**Estimate:** 1.5 hours

**File:** `app/api/propfirm-transactions/route.js`

**Tasks:**
- [ ] Create `GET /api/propfirm-transactions?addresses=0xabc,0xdef&days=7`
- [ ] Parse comma-separated addresses from query params
- [ ] Parse days parameter (default 7)
- [ ] Fetch native and token transactions for all addresses (loop)
- [ ] Process with `processOutgoingTransactions()`
- [ ] Calculate stats with `calculatePropFirmStats()`
- [ ] Group by day with `groupByDay()`
- [ ] Extract top 10 payouts (sort by amountUSD desc)
- [ ] Extract latest payouts (filter last 24 hours)
- [ ] Return JSON with transactions, stats, dailyData, topPayouts, latestPayouts

**Done when:** Endpoint returns outgoing transactions for multiple addresses

**Code template:**
```javascript
import { NextResponse } from 'next/server';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';
import {
  processOutgoingTransactions,
  calculatePropFirmStats,
  groupByDay
} from '@/lib/transactionProcessor';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const addressesParam = searchParams.get('addresses');
  const days = parseInt(searchParams.get('days') || '7');

  if (!addressesParam) {
    return NextResponse.json({ error: 'Addresses required' }, { status: 400 });
  }

  const addresses = addressesParam.split(',').map(a => a.trim());
  const apiKey = process.env.ARBISCAN_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Arbiscan API key not configured' }, { status: 500 });
  }

  // Fetch transactions for all addresses
  const allNativeData = [];
  const allTokenData = [];

  for (const address of addresses) {
    const nativeData = await fetchNativeTransactions(address, apiKey);
    const tokenData = await fetchTokenTransactions(address, apiKey);
    allNativeData.push(...nativeData);
    allTokenData.push(...tokenData);
  }

  // Process outgoing transactions
  const transactions = processOutgoingTransactions(allNativeData, allTokenData, addresses, days);
  const stats = calculatePropFirmStats(transactions);
  const dailyData = groupByDay(transactions, days);

  // Get top 10 largest payouts
  const topPayouts = [...transactions]
    .sort((a, b) => b.amountUSD - a.amountUSD)
    .slice(0, 10);

  // Get latest payouts (last 24 hours)
  const twentyFourHoursAgo = Date.now() / 1000 - (24 * 60 * 60);
  const latestPayouts = transactions.filter(tx => tx.timestamp >= twentyFourHoursAgo);

  return NextResponse.json({
    addresses,
    days,
    ...stats,
    transactions,
    dailyData,
    topPayouts,
    latestPayouts
  });
}
```

---

### TICKET-V1-003: Manual API Testing
**Priority:** P0
**Estimate:** 1 hour

**Tasks:**
- [ ] Test API endpoint directly in browser with test addresses
- [ ] Verify JSON response structure
- [ ] Check that outgoing transactions are filtered correctly (from === address)
- [ ] Verify stats calculations (total, count, largest, time since last)
- [ ] Verify dailyData grouping
- [ ] Verify topPayouts sorting
- [ ] Compare 2-3 transactions with Arbiscan manually
- [ ] Test with different `days` parameters (7, 30)
- [ ] Test error cases (missing addresses, invalid API key)

**Done when:** API works correctly and returns accurate outgoing transaction data

---

## Day 2: Frontend Integration (5-6 hours)

### TICKET-V1-004: Create React Hook for Prop Firm Transactions
**Priority:** P1
**Estimate:** 1 hour

**File:** `lib/hooks/usePropFirmTransactions.js`

**Tasks:**
- [ ] Create `usePropFirmTransactions(addresses, days)` hook
- [ ] Use `useState` for `{ data, loading, error }`
- [ ] Use `useEffect` to fetch on mount and when params change
- [ ] Build query string from addresses array
- [ ] Fetch from `/api/propfirm-transactions`
- [ ] Handle loading and error states

**Done when:** Hook returns data, loading, error states

**Code template:**
```javascript
"use client";
import { useState, useEffect } from 'react';

export function usePropFirmTransactions(addresses, days = 7) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!addresses || addresses.length === 0) return;

    async function fetchData() {
      try {
        setLoading(true);
        const addressesParam = addresses.join(',');
        const response = await fetch(`/api/propfirm-transactions?addresses=${addressesParam}&days=${days}`);
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
  }, [addresses?.join(','), days]);

  return { data, loading, error };
}
```

---

### TICKET-V1-005: Create Prop Firm Detail Page - Stats & Chart
**Priority:** P0
**Estimate:** 2.5 hours

**File:** `app/propfirm/fundingpips/page.js`

**Tasks:**
- [ ] Create new page at `/propfirm/fundingpips`
- [ ] Hardcode test firm data:
  ```javascript
  const TEST_FIRM = {
    name: "FundingPips",
    addresses: [
      "0x1C969652D758f8Fc23C443758f8911086F676216",
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    ]
  };
  ```
- [ ] Import `usePropFirmTransactions` hook
- [ ] Add state for `days` (default 7)
- [ ] Display 4 stat cards:
  - Total Payouts (USD)
  - Number of Payouts
  - Largest Single Payout
  - Time Since Last Payout
- [ ] Add time range selector dropdown (7, 30 days)
- [ ] Create stacked bar chart for daily payouts:
  - Use Recharts (same as v0)
  - X-axis: Date
  - Y-axis: USD amount
  - Stack bars by: Rise, Crypto, Wire Transfer
  - Add legend and tooltip
- [ ] Handle loading/error states
- [ ] Format numbers with `toLocaleString()`

**Done when:** Page displays stats cards and chart with real data

**Code template:**
```javascript
"use client";
import { useState } from 'react';
import { usePropFirmTransactions } from '@/lib/hooks/usePropFirmTransactions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TEST_FIRM = {
  name: "FundingPips",
  addresses: [
    "0x1C969652D758f8Fc23C443758f8911086F676216",
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  ]
};

export default function PropFirmDetailPage() {
  const [days, setDays] = useState(7);
  const { data, loading, error } = usePropFirmTransactions(TEST_FIRM.addresses, days);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8">Error: {error}</div>;

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">{TEST_FIRM.name}</h1>

      {/* Time range selector */}
      <div className="mb-6">
        <select
          className="select select-bordered"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
        </select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-sm">ALL TIME PAYOUTS</h2>
            <p className="text-3xl font-bold">
              ${data.totalPayoutUSD?.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-sm">NO. OF ALL TIME PAYOUTS</h2>
            <p className="text-3xl font-bold">
              {data.totalPayoutCount?.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-sm">LARGEST SINGLE PAYOUT</h2>
            <p className="text-3xl font-bold">
              ${data.largestPayoutUSD?.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-sm">TIME SINCE LAST PAYOUT</h2>
            <p className="text-3xl font-bold">
              {data.timeSinceLastPayout}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card bg-base-100 shadow mb-8">
        <div className="card-body">
          <h2 className="card-title">Total Payouts</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="rise" stackId="a" fill="#4F46E5" name="Rise" />
              <Bar dataKey="crypto" stackId="a" fill="#F59E0B" name="Crypto" />
              <Bar dataKey="wireTransfer" stackId="a" fill="#10B981" name="Wire Transfer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

---

### TICKET-V1-006: Add Top Payouts & Latest Payouts Tables
**Priority:** P1
**Estimate:** 2 hours

**File:** `app/propfirm/fundingpips/page.js` (continue)

**Tasks:**
- [ ] Create "Top 10 Largest Single Payouts" table:
  - Columns: Date, Amount, Payment Method, Tx Hash (link)
  - Use `data.topPayouts`
  - Format date with `toLocaleDateString()`
  - Make Arbiscan link clickable (open in new tab)
- [ ] Create "Latest Payouts" table:
  - Columns: Time Ago, Amount, Token, Tx Hash (link)
  - Use `data.latestPayouts`
  - Calculate time ago (e.g., "4 hours and 8 minutes")
  - Add pagination info (1-13 of 13)
- [ ] Format amounts with `toLocaleString()`
- [ ] Handle empty states (no payouts)
- [ ] Add proper DaisyUI table styling

**Done when:** Both tables display transaction data correctly

**Code template:**
```javascript
{/* Top 10 Largest Payouts */}
<div className="grid grid-cols-2 gap-4 mb-8">
  <div className="card bg-base-100 shadow">
    <div className="card-body">
      <h2 className="card-title">Top 10 Largest Single Payouts</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Method</th>
          </tr>
        </thead>
        <tbody>
          {data.topPayouts?.map(tx => (
            <tr key={tx.txHash}>
              <td>{new Date(tx.timestamp * 1000).toLocaleDateString()}</td>
              <td>${tx.amountUSD.toLocaleString()}</td>
              <td>{tx.paymentMethod}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>

  {/* Latest Payouts */}
  <div className="card bg-base-100 shadow">
    <div className="card-body">
      <h2 className="card-title">Latest Payouts</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Time Ago</th>
            <th>Amount</th>
            <th>Token</th>
          </tr>
        </thead>
        <tbody>
          {data.latestPayouts?.map(tx => {
            const hoursAgo = Math.floor((Date.now() / 1000 - tx.timestamp) / 3600);
            const minutesAgo = Math.floor((Date.now() / 1000 - tx.timestamp) % 3600 / 60);
            return (
              <tr key={tx.txHash}>
                <td>
                  <a
                    href={tx.arbiscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                  >
                    {hoursAgo} hours and {minutesAgo} minutes
                  </a>
                </td>
                <td>${tx.amountUSD.toLocaleString()}</td>
                <td>{tx.token}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-sm mt-2">
        1 - {data.latestPayouts?.length || 0} of {data.latestPayouts?.length || 0}
      </div>
    </div>
  </div>
</div>
```

---

## Day 3: Testing & Cleanup (2-3 hours)

### TICKET-V1-007: Manual Testing & Code Cleanup
**Priority:** P0
**Estimate:** 2-3 hours

**Tasks:**
- [ ] Visit `/propfirm/fundingpips` page
- [ ] Verify all 4 stat cards show correct data
- [ ] Verify chart renders with daily data
- [ ] Test time range selector (switch between 7 and 30 days)
- [ ] Verify top 10 payouts table shows largest transactions
- [ ] Verify latest payouts table shows recent transactions
- [ ] Click Arbiscan links → verify they open correct transaction
- [ ] Compare 5+ transactions manually with Arbiscan to verify:
  - Outgoing direction is correct (FROM firm address)
  - Amounts match
  - Timestamps match
  - USD conversion is reasonable
- [ ] Test with addresses that have NO outgoing transactions
- [ ] Test loading states (throttle network)
- [ ] Test error states (invalid addresses)
- [ ] Remove console.logs
- [ ] Add comments to key functions
- [ ] Run `npm run lint` and fix issues
- [ ] Run `npm run build` and verify it succeeds
- [ ] Add TODO comments:
  ```javascript
  // TODO (v2): Add database for multiple firms
  // TODO (v2): Implement payment method auto-detection
  // TODO (v2): Replace constant prices with historical API
  ```

**Done when:** All features work, data is verified, code is clean, builds successfully

---

## Summary

### Total Effort: 12-14 hours (2-3 days)
- **Day 1 (API):** 4-5 hours
- **Day 2 (Frontend):** 5-6 hours
- **Day 3 (Testing):** 2-3 hours

### Critical Path:
V1-001 → V1-002 → V1-003 → V1-004 → V1-005 → V1-006 → V1-007

### Parallel Work:
- None - all tickets are sequential

### Definition of Done:
- ✅ API fetches outgoing transactions for multiple addresses
- ✅ Firm detail page shows accurate stats (total, count, largest, time since last)
- ✅ Chart displays daily payout totals with breakdown
- ✅ Tables show top 10 and latest payouts with Arbiscan links
- ✅ Stats aggregate correctly across all firm addresses
- ✅ Time range selector works (7 vs 30 days)
- ✅ `npm run build` succeeds
- ✅ Manual data verification matches Arbiscan

---

## Reused from v0

The following v0 components/functions are **reused as-is**:
- ✅ `lib/arbiscan.js` - No changes needed
- ✅ `convertToUSD()` function - No changes needed
- ✅ Recharts setup and configuration - Adapt for daily data
- ✅ UI patterns (cards, tables) - Copy and adapt

The following v0 components require **modifications**:
- 🔧 `lib/transactionProcessor.js` - Add outgoing transaction support
- 🔧 Transaction filtering logic - Reverse direction (from instead of to)
- 🔧 Time range calculations - Support configurable days parameter

---

## Technical Debt for v2

⚠️ **Carried over from v0:**
1. Historical USD prices (still using $2500 ETH constant)
2. Caching layer
3. Error handling & retry logic
4. Rate limiting

⚠️ **New for v2:**
1. Database integration (Supabase for prop firm management)
2. CRUD operations for firms and addresses
3. Prop firm list page
4. Payment method auto-detection (currently all "Crypto")
5. Trader identification (currently just addresses)
6. Multi-user authentication
