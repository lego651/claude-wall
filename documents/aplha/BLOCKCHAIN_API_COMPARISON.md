# Blockchain API Comparison 2025

Comprehensive comparison of blockchain explorer and data APIs as alternatives to Arbiscan/Etherscan.

---

## 📊 Quick Comparison Table

| Provider | Free Tier | Batch Queries | Aggregation | Rate Limit (calls/sec) | Daily Limit | Best For |
|----------|-----------|---------------|-------------|----------------------|-------------|----------|
| **Etherscan/Arbiscan** | ✅ Limited chains | ❌ No | ❌ No | 5/s | 100K/day | Simple queries, free tier |
| **Alchemy** | ✅ 30M CUs | ✅ Yes | ❌ No | 500 CU/s | 30M CU/month | RPC calls, high throughput |
| **QuickNode** | ⚠️ Credits-based | ✅ Yes | ❌ No | Varies by plan | Credits-based | Performance, global PoPs |
| **Moralis** | ✅ 40K CUs/day | ⚠️ Limited | ✅ Yes | 25 RPS | 10M/month | Web3 data, wallets |
| **Infura** | ⚠️ Credits-based | ✅ Yes | ❌ No | Varies | Credits/day | RPC infrastructure |
| **Blockchair** | ✅ 1K/day | ✅ Yes | ✅✅ SQL-like | N/A | 1K (free) | Analytics, multi-chain |
| **Covalent (GoldRush)** | ✅ Yes | ⚠️ Limited | ✅✅ Unified | 4 RPS | N/A | Unified multi-chain data |
| **The Graph** | ✅ 100K queries/mo | ✅ GraphQL | ✅✅ GraphQL | Unlimited | 100K/month | Custom indexing, GraphQL |

---

## 1️⃣ Etherscan / Arbiscan (Baseline)

### Pricing Tiers

| Tier | Price | Rate Limit | Daily Calls | Notes |
|------|-------|-----------|-------------|-------|
| **Free** | $0 | 5 calls/sec | 100,000 | Limited chains (90% coverage) |
| **Lite** | ~$12/month | Unknown | Unknown | 25% of previous lowest tier |
| **Standard** | $49/month | 10 calls/sec | Unlimited | Full chain coverage |
| **Advanced** | $99/month | 20 calls/sec | Unlimited | Priority support |
| **Professional** | $299/month | 30 calls/sec | Unlimited | Dedicated support |

### Key Features

✅ **Pros:**
- Simple API with extensive documentation
- Reliable uptime (blockchain data source)
- Free tier covers most use cases
- No complex authentication

❌ **Cons:**
- **No batch queries** - Must query each address individually
- **No aggregation API** - Compute metrics client-side
- **Recent paywalls (2025)** - Avalanche, Base, BNB, OP now require paid plans
- **Limited query complexity** - Basic filtering only
- **5 calls/sec rate limit** - Slow for large-scale syncing

### Batch Queries
**❌ Not Supported**

### Aggregation API
**❌ Not Supported** - Must fetch raw transactions and aggregate locally

### Complex Query Support
**⚠️ Limited** - Basic filtering by address, date, and transaction type only

---

## 2️⃣ Alchemy

### Pricing Tiers

| Tier | Price | Compute Units | Throughput | Notes |
|------|-------|--------------|-----------|-------|
| **Free** | $0 | 30M CU/month | 500 CU/s | ~1.8M simple requests |
| **Pay-As-You-Go** | Variable | First 300M: $0.45/M CU | Elastic | Drops to $0.40/M CU after 300M |
| **Enterprise** | Custom | Unlimited | Custom | 24/7 support, pay in crypto |

### Compute Unit Examples
- `eth_blockNumber`: 10 CU
- `eth_call`: 26 CU
- `eth_getLogs`: 75 CU

### Key Features

✅ **Pros:**
- Generous free tier (30M CU = ~1.8M simple requests)
- High throughput (500 CU/s = ~300 RPS on Ethereum)
- Elastic burst capacity beyond reserved limits
- Pay-as-you-go flexibility
- 10-second rolling window for rate limits (can burst)

❌ **Cons:**
- Complex pricing (compute units vs requests)
- No native aggregation API
- Primarily RPC-focused (not explorer-style queries)
- Credit system harder to predict costs

### Batch Queries
**✅ Supported** - Standard JSON-RPC batch requests

```javascript
// Batch example
[
  {"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]},
  {"jsonrpc":"2.0","id":2,"method":"eth_getBalance","params":["0x...", "latest"]}
]
```

### Aggregation API
**❌ Not Built-in** - RPC interface only, must aggregate client-side

### Complex Query Support
**⚠️ Limited** - Standard RPC methods, use Enhanced APIs for complex queries

---

## 3️⃣ QuickNode

### Pricing Tiers

| Tier | Price | API Credits | Rate Limit | Notes |
|------|-------|------------|-----------|-------|
| **Build** | $9/month | 1M credits | Lower RPS | Development |
| **Scale** | $49/month | 10M credits | Medium RPS | Production apps |
| **Enterprise** | Custom | Unlimited | Custom RPS | Dedicated nodes |

### API Credit System
- Base calls: 20 credits
- `eth_getLogs`: Higher credit value (6x)
- Credits consumed per method complexity

### Key Features

✅ **Pros:**
- Global PoPs (Points of Presence) for low latency
- Streams & Webhooks for real-time events
- Add-on marketplace (Jupiter, Metis, etc.)
- Method-level rate limiting control
- Dedicated nodes for guaranteed resources

❌ **Cons:**
- Credit system complexity
- Batch requests count toward total RPS (no savings)
- Must implement client-side rate limiting
- Pricing less transparent than competitors

### Batch Queries
**✅ Supported** - But no RPS discount (each call in batch counts)

```javascript
// Warning: All requests count toward RPS limit
// 10 requests in batch = 10 toward your limit
```

### Aggregation API
**❌ Not Built-in** - Standard RPC only

### Complex Query Support
**⚠️ Limited** - RPC methods, enhanced by add-ons

---

## 4️⃣ Moralis

### Pricing Tiers

| Tier | Price | Compute Units | Rate Limit | Requests/Month | Notes |
|------|-------|--------------|-----------|---------------|-------|
| **Free** | $0 | ~40K CU/day | 25 RPS, 150 CU/s | 10M | For testing |
| **Pro** | $49/month | Higher quota | 1500 CU/s | Higher | Blockchain pros |
| **Business** | $249/month | Even higher | 300 CU/s | Higher | Teams |
| **Enterprise** | Custom | Unlimited | 3000+ CU/s | Unlimited | Large-scale |

### Key Features

✅ **Pros:**
- Web3-focused data (wallets, NFTs, tokens, DeFi)
- Multi-chain support (Ethereum, BSC, Polygon, etc.)
- **Built-in aggregation** - Wallet balance, portfolio tracking
- Simple API for common Web3 use cases
- Real-time webhooks for events

❌ **Cons:**
- Compute unit pricing can be expensive
- Lower throughput than Alchemy on free tier
- Limited batch query support
- Business tier has lower CU/s than Pro (pricing anomaly)

### Batch Queries
**⚠️ Limited** - Some endpoints support batch, but not comprehensive

### Aggregation API
**✅ Supported** - Wallet balances, NFT collections, token holdings

```javascript
// Example: Get all token balances for a wallet (single call)
GET /api/v2.2/{address}/erc20
```

### Complex Query Support
**✅ Good** - Filters, pagination, date ranges, token-specific queries

---

## 5️⃣ Infura

### Pricing Tiers

| Tier | Price | Credits/Day | Throughput | Notes |
|------|-------|------------|-----------|-------|
| **Developer** | $0 | 100K credits | Limited CU/s | Testnet + Ethereum |
| **Team** | $50/month | 10M credits | Higher | Multi-chain |
| **Growth** | $225/month | 50M credits | Higher | Advanced features |
| **Enterprise** | Custom | 75M+ credits | Custom | Custom SLAs |

### Credit System
- Each API method has a credit cost
- Resets daily at 00:00 UTC
- Exceeding limit halts access until reset

### Key Features

✅ **Pros:**
- Reliable infrastructure (ConsenSys-backed)
- Multi-chain support (Ethereum, Polygon, Optimism, etc.)
- IPFS integration
- Simple credit-based pricing
- WebSocket support

❌ **Cons:**
- **Daily credit reset is harsh** - No rollover, service stops at limit
- Batch calls don't save credits (each call counted)
- No aggregation API
- RPC-focused only

### Batch Queries
**✅ Supported** - Standard JSON-RPC batch, but no credit savings

### Aggregation API
**❌ Not Built-in** - RPC interface only

### Complex Query Support
**⚠️ Limited** - Standard RPC methods

---

## 6️⃣ Blockchair

### Pricing Tiers

| Tier | Price | Daily Calls | Request Cost | Notes |
|------|-------|------------|-------------|-------|
| **Free** | $0 | 1,000 | Standard: 1 | Testing only |
| **Paid** | From $25 | Higher | Batch: Higher | Pay-per-use or monthly |
| **Enterprise** | Custom | Unlimited | N/A | No blocking at limit |

### Key Features

✅ **Pros:**
- **SQL-like queries** - Advanced filtering, sorting, aggregation
- **Multi-chain** - 48+ blockchains supported
- **Aggregation built-in** - Sum, count, average, group by
- **Batch queries** - Up to 10 blocks/transactions at once
- Privacy-focused (no tracking, no ads)
- Pay-as-you-go or monthly plans

❌ **Cons:**
- Free tier very limited (1K calls/day)
- Batch queries cost more request credits
- Not real-time (some data may lag)
- Learning curve for SQL-like syntax

### Batch Queries
**✅ Supported** - Comma-separated values for up to 10 items

```javascript
// Query multiple blocks at once
GET /bitcoin/dashboards/blocks/100000,100001,100002
```

**Note:** Batch queries consume more request credits

### Aggregation API
**✅✅ Excellent** - SQL-like queries with GROUP BY, SUM, AVG, etc.

```javascript
// Example: Sum all transactions by day
GET /bitcoin/transactions?a=date,sum(fee)
```

### Complex Query Support
**✅✅ Excellent** - Full SQL-like syntax:
- Filtering: `?q=recipient(address),time(2024-01-01..)`
- Sorting: `?s=value(desc)`
- Aggregation: `?a=date,count(),sum(value)`
- Pagination: `?offset=0&limit=100`

---

## 7️⃣ Covalent (GoldRush)

### Pricing Tiers

| Tier | Price | Rate Limit | Notes |
|------|-------|-----------|-------|
| **Free** | $0 | 4 RPS | Development |
| **Premium** | $50/month | 50 RPS | 12.5x higher throughput |
| **Enterprise** | Custom | Custom | Custom SLAs |

### Key Features

✅ **Pros:**
- **Unified API** - Single call for multi-chain data (90+ blockchains)
- **Built-in aggregation** - Market data across chains
- **Real-time** - 30s or 2 blocks refresh rate
- **Historical data** - From genesis block
- **Wallet-centric** - Per-wallet investment performance
- **AI & Agents focus** (2025 rebrand)

❌ **Cons:**
- Free tier very limited (4 RPS)
- Premium jump is significant ($0 → $50)
- Less documentation than competitors
- API structure less intuitive

### Batch Queries
**⚠️ Limited** - Not extensively documented

### Aggregation API
**✅✅ Excellent** - Cross-chain aggregation in single calls

```javascript
// Example: Get portfolio value across all chains
GET /v1/address/{wallet}/portfolio_v2/
```

### Complex Query Support
**✅ Good** - Wallet-level queries, historical balances, transaction history

---

## 8️⃣ The Graph (Protocol)

### Pricing Tiers

| Tier | Price | Monthly Queries | Notes |
|------|-------|----------------|-------|
| **Free** | $0 | 100,000 | Development/testing |
| **Growth** | Pay-per-query | 100K+ | $2 per 100K queries |

### Payment Methods
- GRT tokens (native cryptocurrency)
- Credit card
- Invoiced monthly

### Key Features

✅ **Pros:**
- **GraphQL native** - Flexible, powerful queries
- **Custom indexing** - Deploy your own subgraphs
- **Decentralized** - No single point of failure
- **Pagination** - Up to 1,000 items per query
- **Batch queries** - GraphQL standard batching
- **No rate limits** (once published to network)
- **Complex queries** - Nested relationships, filters, sorting

❌ **Cons:**
- Requires deploying/using subgraphs (setup overhead)
- Free tier rate-limited (testing only)
- Must understand GraphQL
- Published subgraphs cost GRT or $
- Not as plug-and-play as REST APIs

### Batch Queries
**✅ Supported** - Native GraphQL batching

```graphql
query BatchQuery {
  account1: account(id: "0x123") { balance }
  account2: account(id: "0x456") { balance }
}
```

### Aggregation API
**✅✅ Excellent** - GraphQL aggregations, custom indexing

```graphql
query TotalVolume {
  pairs {
    volumeUSD
  }
}
```

### Complex Query Support
**✅✅ Excellent** - Full GraphQL capabilities:
- Nested queries
- Filtering: `where: { balance_gt: "1000" }`
- Sorting: `orderBy: balance, orderDirection: desc`
- Pagination: `first: 100, skip: 0`
- Relationships: Query across entities

---

## 🎯 Recommendations by Use Case

### For Your Propfirm Use Case (Current: Arbiscan)

**Current Usage:**
- 8 firms × 1 address × 2 calls = 16 calls per sync
- 48 syncs/day = 768 calls/day
- Need: Transaction history filtering, no aggregation needed

#### Option 1: **Stay with Arbiscan** ✅
**Why:**
- Well within free tier (768/day << 100,000/day)
- Simple API, no migration needed
- Arbitrum-specific (not affected by Etherscan multi-chain paywall)

**When to switch:**
- Scaling to 50+ firms (12,800 calls/day, still fine)
- Need batch queries (not available)
- Need faster than 5 calls/sec

---

#### Option 2: **Upgrade to Alchemy** (If scaling)
**Why:**
- 30M CU/month free = ~52K requests/day (vs 768 needed)
- Higher throughput (500 CU/s vs 5 calls/s)
- Burst capacity for spikes

**Cost:**
- Free tier sufficient for current + 65x growth
- $0.45/M CU after 30M (very cheap)

**Migration effort:** Medium (different API structure)

---

#### Option 3: **Switch to Blockchair** (If need analytics)
**Why:**
- SQL-like queries for complex filtering
- Built-in aggregation (sum payouts, group by day)
- Multi-chain (if expanding beyond Arbitrum)

**Cost:**
- Free tier only 1K/day (need paid: $25+)

**Migration effort:** High (new query syntax)

---

#### Option 4: **The Graph** (If need custom indexing)
**Why:**
- Build custom subgraph for propfirm-specific queries
- No rate limits once published
- GraphQL flexibility

**Cost:**
- Free for 100K queries/month
- $2 per 100K after

**Migration effort:** Very High (requires subgraph development)

---

### Quick Decision Matrix

| If You Need... | Use This |
|----------------|----------|
| **Stay simple, free tier** | Arbiscan (current) |
| **Higher throughput, burst traffic** | Alchemy |
| **Complex analytics, SQL queries** | Blockchair |
| **Multi-chain unified data** | Covalent (GoldRush) |
| **Custom indexing, GraphQL** | The Graph |
| **Wallet-focused Web3 data** | Moralis |
| **Reliable RPC infrastructure** | Infura or QuickNode |
| **Global low-latency** | QuickNode |

---

### Cost Comparison for Your Scale

**Current: 784 calls/day (~23,520/month)**

| Provider | Monthly Cost | Notes |
|----------|--------------|-------|
| **Arbiscan (Free)** | **$0** | ✅ Best option now |
| **Alchemy** | **$0** | Free tier covers 1,276x your usage |
| **Moralis** | **$0** | Free tier covers 425x your usage |
| **The Graph** | **$0** | Free tier covers 4.2x your usage |
| **Blockchair** | **$25+** | Free tier insufficient (1K/day) |
| **Covalent** | **$0 or $50** | Free 4 RPS likely sufficient |
| **Infura** | **$0** | Free tier sufficient |
| **QuickNode** | **$0 or $9+** | Depends on credit usage |

---

## 🚀 Migration Considerations

### Low Effort (1-2 days)
1. **Alchemy** - Similar REST API, batch support
2. **Moralis** - If using wallet/token data
3. **Infura** - Standard RPC migration

### Medium Effort (1 week)
1. **Blockchair** - Learn SQL-like syntax
2. **Covalent** - Different endpoint structure
3. **QuickNode** - Credit system complexity

### High Effort (2-4 weeks)
1. **The Graph** - Build/deploy subgraph, learn GraphQL

---

## 📊 Feature Comparison Summary

| Feature | Etherscan/Arbiscan | Alchemy | QuickNode | Moralis | Infura | Blockchair | Covalent | The Graph |
|---------|-------------------|---------|-----------|---------|--------|-----------|----------|-----------|
| **Batch Queries** | ❌ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ |
| **Aggregation** | ❌ | ❌ | ❌ | ✅ | ❌ | ✅✅ | ✅✅ | ✅✅ |
| **SQL-like** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅✅ | ❌ | ❌ |
| **GraphQL** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅✅ |
| **Multi-chain** | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅✅ | ✅✅ | ✅ |
| **Real-time** | ⚠️ 30s | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| **Free Tier** | ✅ | ✅✅ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| **Easy Setup** | ✅✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |

---

## 🎯 Final Recommendation

**For your current use case:** **Stick with Arbiscan (Free tier)**

**Reasons:**
1. ✅ Well within limits (768/day << 100K/day)
2. ✅ Free forever at current scale
3. ✅ No migration effort
4. ✅ Simple API, well-documented
5. ✅ Arbitrum-native (not affected by Etherscan multi-chain cuts)

**When to reconsider:**
- 📈 **Scaling to 50+ firms** → Consider Alchemy (still free, higher throughput)
- 📊 **Need analytics/aggregation** → Blockchair or The Graph
- 🌍 **Multi-chain expansion** → Covalent or Moralis
- ⚡ **Need <5 min real-time** → Alchemy or QuickNode with webhooks

---

**Updated:** January 2025
