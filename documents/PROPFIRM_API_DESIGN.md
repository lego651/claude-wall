# Prop Firm Payout Tracking - API Design Document

> **Version:** 1.0  
> **Created:** January 20, 2026  
> **Status:** Draft  
> **Reference:** Similar to [payoutjunction.com](https://payoutjunction.com)

---

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
   - [Endpoint 1: List Prop Firms](#endpoint-1-list-prop-firms)
   - [Endpoint 2: Firm Chart Data](#endpoint-2-firm-chart-data)
   - [Endpoint 3: Top Payouts](#endpoint-3-top-payouts)
   - [Endpoint 4: Latest Payouts](#endpoint-4-latest-payouts)
3. [Data Architecture](#data-architecture)
4. [Arbiscan API Constraints](#arbiscan-api-constraints)
5. [Implementation Notes](#implementation-notes)

---

## Overview

### Features

We're building a prop firm payout tracking feature with two main pages:

1. **Prop Firm List Page** - Shows all firms with aggregated payout metrics
2. **Prop Firm Detail Page** - Deep dive into a specific firm's payout data

### Summary Table

| # | Endpoint | Purpose | Period Options | Returns |
|---|----------|---------|----------------|---------|
| 1 | `GET /api/v2/propfirms` | List page | `1d`, `7d`, `30d`, `12m` | All firms + metrics |
| 2 | `GET /api/v2/propfirms/[id]/chart` | Chart + summary | `30d`, `12m` | Summary stats + chart buckets |
| 3 | `GET /api/v2/propfirms/[id]/top-payouts` | Top payouts | `30d`, `12m` | Top 10 largest payouts |
| 4 | `GET /api/v2/propfirms/[id]/latest-payouts` | Real-time feed | None (real-time) | Top 20 most recent |

---

## API Endpoints

### Endpoint 1: List Prop Firms

**`GET /api/v2/propfirms`**

Returns all prop firms with aggregated metrics for the selected period.

#### Request

```
GET /api/v2/propfirms?period=1d&sort=totalPayouts&order=desc
```

#### Query Parameters

| Param | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `period` | string | `1d` | `1d`, `7d`, `30d`, `12m` | Time window for metrics calculation |
| `sort` | string | `totalPayouts` | `totalPayouts`, `payoutCount`, `largestPayout`, `avgPayout`, `latestPayout` | Sort field |
| `order` | string | `desc` | `asc`, `desc` | Sort direction |

#### Response

```json
{
  "data": [
    {
      "id": "fundednext",
      "name": "FundedNext",
      "logo": "https://example.com/logos/fundednext.png",
      "website": "https://fundednext.com",
      "metrics": {
        "totalPayouts": 795423,
        "payoutCount": 405,
        "largestPayout": 17900,
        "avgPayout": 1964,
        "latestPayoutAt": "2026-01-20T10:25:00Z",
        "timeSinceLastPayout": "35 minutes"
      }
    },
    {
      "id": "myfundedfutures",
      "name": "MyFundedFutures",
      "logo": "https://example.com/logos/myfundedfutures.png",
      "website": "https://myfundedfutures.com",
      "metrics": {
        "totalPayouts": 454495,
        "payoutCount": 283,
        "largestPayout": 11091,
        "avgPayout": 1606,
        "latestPayoutAt": "2026-01-20T09:39:00Z",
        "timeSinceLastPayout": "1 hours and 21 minutes"
      }
    },
    {
      "id": "tradeify",
      "name": "Tradeify",
      "logo": "https://example.com/logos/tradeify.png",
      "website": "https://tradeify.com",
      "metrics": {
        "totalPayouts": 423396,
        "payoutCount": 158,
        "largestPayout": 15750,
        "avgPayout": 2680,
        "latestPayoutAt": "2026-01-20T10:43:00Z",
        "timeSinceLastPayout": "17 minutes"
      }
    }
  ],
  "meta": {
    "period": "1d",
    "sort": "totalPayouts",
    "order": "desc",
    "count": 15
  }
}
```

#### Notes

- No pagination - always returns all firms
- Metrics are calculated based on the selected `period`
- Default sort is by `totalPayouts` descending (highest paying firms first)

---

### Endpoint 2: Firm Chart Data

**`GET /api/v2/propfirms/[id]/chart`**

Returns chart data and summary statistics for a specific firm.

#### Request

```
GET /api/v2/propfirms/fundednext/chart?period=30d
```

#### Query Parameters

| Param | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `period` | string | `30d` | `30d`, `12m` | Chart period and bucket type |

#### Period Behavior

| Period | Bucket Type | Data Points |
|--------|-------------|-------------|
| `30d` | Daily | 30 items |
| `12m` | Monthly | 12 items |

#### Response (period=30d)

```json
{
  "firm": {
    "id": "fundednext",
    "name": "FundedNext",
    "logo": "https://example.com/logos/fundednext.png",
    "website": "https://fundednext.com"
  },
  "summary": {
    "totalPayouts": 14683038,
    "payoutCount": 5715,
    "largestPayout": 346838,
    "avgPayout": 2568,
    "latestPayoutAt": "2026-01-20T10:24:00Z",
    "timeSinceLastPayout": "36min"
  },
  "chart": {
    "period": "30d",
    "bucketType": "daily",
    "data": [
      {
        "date": "2025-12-21",
        "total": 125000,
        "rise": 100000,
        "crypto": 20000,
        "wire": 5000
      },
      {
        "date": "2025-12-22",
        "total": 980000,
        "rise": 850000,
        "crypto": 100000,
        "wire": 30000
      },
      {
        "date": "2025-12-23",
        "total": 450000,
        "rise": 400000,
        "crypto": 40000,
        "wire": 10000
      }
    ]
  }
}
```

#### Response (period=12m)

```json
{
  "firm": {
    "id": "fundednext",
    "name": "FundedNext",
    "logo": "https://example.com/logos/fundednext.png",
    "website": "https://fundednext.com"
  },
  "summary": {
    "totalPayouts": 146830386,
    "payoutCount": 57158,
    "largestPayout": 346838,
    "avgPayout": 2568,
    "latestPayoutAt": "2026-01-20T10:24:00Z",
    "timeSinceLastPayout": "36min"
  },
  "chart": {
    "period": "12m",
    "bucketType": "monthly",
    "data": [
      {
        "month": "Feb 2025",
        "total": 8500000,
        "rise": 7000000,
        "crypto": 1200000,
        "wire": 300000
      },
      {
        "month": "Mar 2025",
        "total": 9200000,
        "rise": 7500000,
        "crypto": 1400000,
        "wire": 300000
      }
    ]
  }
}
```

#### Notes

- Summary stats are calculated for the selected period
- Chart data is broken down by payment method: `rise`, `crypto`, `wire`
- `total` = `rise` + `crypto` + `wire`

---

### Endpoint 3: Top Payouts

**`GET /api/v2/propfirms/[id]/top-payouts`**

Returns the top 10 largest single payouts for the selected period.

#### Request

```
GET /api/v2/propfirms/fundednext/top-payouts?period=30d
```

#### Query Parameters

| Param | Type | Default | Options | Description |
|-------|------|---------|---------|-------------|
| `period` | string | `30d` | `30d`, `12m` | Same period options as chart |

#### Response

```json
{
  "firmId": "fundednext",
  "period": "30d",
  "payouts": [
    {
      "id": "tx_abc123",
      "date": "2025-12-25",
      "amount": 46838,
      "paymentMethod": "rise",
      "txHash": "0x1234567890abcdef1234567890abcdef12345678",
      "arbiscanUrl": "https://arbiscan.io/tx/0x1234567890abcdef1234567890abcdef12345678"
    },
    {
      "id": "tx_def456",
      "date": "2025-12-22",
      "amount": 34318,
      "paymentMethod": "crypto",
      "txHash": "0xabcdef1234567890abcdef1234567890abcdef12",
      "arbiscanUrl": "https://arbiscan.io/tx/0xabcdef1234567890abcdef1234567890abcdef12"
    },
    {
      "id": "tx_ghi789",
      "date": "2025-12-20",
      "amount": 28500,
      "paymentMethod": "rise",
      "txHash": "0x567890abcdef1234567890abcdef1234567890ab",
      "arbiscanUrl": "https://arbiscan.io/tx/0x567890abcdef1234567890abcdef1234567890ab"
    }
  ]
}
```

#### Notes

- Always returns maximum 10 items
- Sorted by `amount` descending
- Uses same period filter as chart endpoint for consistency

---

### Endpoint 4: Latest Payouts

**`GET /api/v2/propfirms/[id]/latest-payouts`**

Returns the 20 most recent payouts in real-time. No period filter.

#### Request

```
GET /api/v2/propfirms/fundednext/latest-payouts
```

#### Query Parameters

None - always returns the 20 most recent payouts.

#### Response

```json
{
  "firmId": "fundednext",
  "payouts": [
    {
      "id": "tx_xyz789",
      "timestamp": "2026-01-20T10:24:00Z",
      "timeSince": "36 minutes",
      "amount": 233,
      "paymentMethod": "rise",
      "txHash": "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
      "arbiscanUrl": "https://arbiscan.io/tx/0xaaaa1111bbbb2222cccc3333dddd4444eeee5555"
    },
    {
      "id": "tx_uvw012",
      "timestamp": "2026-01-20T10:20:00Z",
      "timeSince": "40 minutes",
      "amount": 420,
      "paymentMethod": "crypto",
      "txHash": "0xbbbb2222cccc3333dddd4444eeee5555ffff6666",
      "arbiscanUrl": "https://arbiscan.io/tx/0xbbbb2222cccc3333dddd4444eeee5555ffff6666"
    },
    {
      "id": "tx_rst345",
      "timestamp": "2026-01-20T09:58:00Z",
      "timeSince": "1 hours and 2 minutes",
      "amount": 1250,
      "paymentMethod": "rise",
      "txHash": "0xcccc3333dddd4444eeee5555ffff6666gggg7777",
      "arbiscanUrl": "https://arbiscan.io/tx/0xcccc3333dddd4444eeee5555ffff6666gggg7777"
    }
  ],
  "count": 20
}
```

#### Notes

- Always returns maximum 20 items
- Real-time data (no period filtering)
- `timeSince` is calculated relative to current time
- Sorted by `timestamp` descending (most recent first)

---

## Data Architecture

### Recommended Pattern: "Sync & Serve"

Instead of calling Arbiscan API in real-time on every request, we use a background sync pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                     BACKGROUND SYNC (Cron)                       │
│  ┌──────────┐      ┌──────────────┐      ┌─────────────────┐   │
│  │ pg_cron  │ ───▶ │ Edge Function│ ───▶ │ Arbiscan API    │   │
│  │ (hourly) │      │ (sync job)   │      │ (rate-limited)  │   │
│  └──────────┘      └──────────────┘      └─────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│                    ┌──────────────┐                              │
│                    │  Supabase    │                              │
│                    │  (payouts    │                              │
│                    │   table)     │                              │
│                    └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     USER REQUEST (Real-time)                     │
│  ┌──────────┐      ┌──────────────┐      ┌─────────────────┐   │
│  │ Browser  │ ───▶ │ Next.js API  │ ───▶ │ Supabase        │   │
│  │          │      │ (instant)    │      │ (indexed query) │   │
│  └──────────┘      └──────────────┘      └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Supabase Schema (Proposed)

```sql
-- Prop Firms table
CREATE TABLE prop_firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  website TEXT,
  addresses TEXT[] NOT NULL,  -- Wallet addresses to track
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payouts table
CREATE TABLE payouts (
  id TEXT PRIMARY KEY,  -- tx_hash
  firm_id TEXT REFERENCES prop_firms(id),
  amount DECIMAL(18, 2) NOT NULL,
  payment_method TEXT NOT NULL,  -- 'rise', 'crypto', 'wire'
  tx_hash TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_payouts_firm_id (firm_id),
  INDEX idx_payouts_timestamp (timestamp DESC),
  INDEX idx_payouts_firm_timestamp (firm_id, timestamp DESC),
  INDEX idx_payouts_firm_amount (firm_id, amount DESC)
);
```

---

## Arbiscan API Constraints

### Rate Limits

| Tier | Rate Limit | Cost |
|------|------------|------|
| Free | 5 calls/second | $0 |
| Standard | 10 calls/second | $199/month |
| Pro | 30 calls/second | Custom |

### Why Background Sync?

With 15+ prop firms, each needing 2 API calls (native + token txs):
- Single page load = 30+ API calls
- Multiple concurrent users = Rate limit exceeded

### Alternative Data Sources

| Provider | Pros | Cons | Cost |
|----------|------|------|------|
| Alchemy | Higher throughput, websockets | Complex setup | Free tier |
| QuickNode | Fast, reliable | Overkill for this | $49+/mo |
| The Graph | Custom indexer, real-time | Requires subgraph dev | Free |
| Dune Analytics | Pre-built queries, SQL | 15min delay | Free tier |

---

## Implementation Notes

### Payment Method Mapping

| Token/Source | `paymentMethod` value |
|--------------|----------------------|
| RISEPAY token | `rise` |
| USDC, USDT, ETH | `crypto` |
| Off-chain wire | `wire` |

### Time Calculations

```javascript
// timeSince calculation
function calculateTimeSince(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}hr`;
  }
  
  if (hours > 0) {
    return `${hours} hours and ${minutes} minutes`;
  }
  
  return `${minutes} minutes`;
}
```

### Period Calculations

| Period | Start Date | End Date |
|--------|------------|----------|
| `1d` | NOW - 24 hours | NOW |
| `7d` | NOW - 7 days | NOW |
| `30d` | NOW - 30 days | NOW |
| `12m` | NOW - 12 months | NOW |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-20 | Initial API design |
