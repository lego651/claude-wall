# PropVerified v0 Scope (SIMPLIFIED)

## Overview
v0 is an **alpha version for internal testing only**. Goal: Validate that we can fetch and display real blockchain transaction data.

## Key Principles
- **Minimal complexity** - No caching, no complex error handling, simple USD conversion
- **No authentication** - Internal testing only with hardcoded wallet
- **Real blockchain data** - Fetch from Arbitrum via Arbiscan API
- **Fast to build** - 2-3 days total

---

## What We're Building

### 1. API Endpoint
**Route:** `GET /api/transactions?address={address}`

**What it does:**
- Fetch incoming ETH and ERC-20 token (USDC/USDT) transactions from Arbiscan
- Convert to USD using **simple constant prices**:
  - **ETH = $2500** (constant, not historical)
  - **USDC/USDT = $1.00**
  - ⚠️ **TODO (Phase 1):** Replace with historical prices via CoinGecko
- Filter out transactions < $10 (spam)
- Return last 100 transactions max
- **No caching** - Fresh data each request

**Response:**
```json
{
  "address": "0x1C969652D758f8Fc23C443758f8911086F676216",
  "totalTransactions": 47,
  "totalPayoutUSD": 215000,
  "last30DaysPayoutUSD": 22000,
  "last30DaysCount": 3,
  "avgPayoutUSD": 4574,
  "transactions": [
    {
      "txHash": "0xabc123...",
      "timestamp": 1717574400,
      "date": "2024-06-15T10:00:00Z",
      "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "fromShort": "0x742d...0bEb",
      "amount": "0.5",
      "amountUSD": 1250.00,
      "token": "ETH",
      "arbiscanUrl": "https://arbiscan.io/tx/0xabc123..."
    }
  ],
  "monthlyData": [
    {"month": "Jan", "amount": 4500},
    {"month": "Feb", "amount": 5200}
  ]
}
```

### 2. Update Trader Profile Page
**Route:** `/trader/thefundedlady` (reuse existing page)

**Changes:**
- Hardcode test wallet: `0x1C969652D758f8Fc23C443758f8911086F676216`
- Replace mock data with API call to `/api/transactions`
- Display real stats (total, last 30 days, avg)
- Show real transaction table with Arbiscan links
- Update monthly chart with real data
- Keep UI/design as-is

---

## Simplified Technical Approach

### Error Handling
- ❌ **No complex error handling** for v0
- If API fails → show error message to user
- Log errors to console
- Investigate issues during testing

### Caching
- ❌ **No caching** for v0
- Direct Arbiscan API call each request
- Can add in Phase 1 if rate limits are an issue

### USD Conversion
- ❌ **No historical price API** for v0
- Use simple constants:
  ```javascript
  const PRICES = {
    ETH: 2500,
    USDC: 1.00,
    USDT: 1.00
  };
  ```
- ⚠️ **Technical debt:** Replace with CoinGecko historical prices in Phase 1

---

## Out of Scope (v0)

### Explicitly NOT Building:
- ❌ User authentication
- ❌ Multiple user profiles
- ❌ Database storage
- ❌ Caching layer
- ❌ Historical USD prices (using constants)
- ❌ Complex error handling
- ❌ Retry logic
- ❌ Rate limiting protection
- ❌ Prop firm identification
- ❌ Leaderboard updates (keep as mock data)

---

## Technical Implementation

### File Structure
```
app/api/transactions/route.js          # Main API endpoint
lib/arbiscan.js                         # Arbiscan API helper
lib/transactionProcessor.js             # Process & format transactions
lib/hooks/useTransactions.js            # React hook for frontend
app/trader/[handle]/page.js             # Update to use real data
```

### Key Functions

**lib/arbiscan.js:**
```javascript
export async function fetchNativeTransactions(address, apiKey) {
  // GET https://api.arbiscan.io/api?module=account&action=txlist&address={address}&sort=desc&apikey={key}
  // Return parsed transaction array
}

export async function fetchTokenTransactions(address, apiKey) {
  // GET https://api.arbiscan.io/api?module=account&action=tokentx&address={address}&sort=desc&apikey={key}
  // Return parsed ERC-20 transaction array
}
```

**lib/transactionProcessor.js:**
```javascript
const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00 };

export function convertToUSD(amount, token) {
  return amount * PRICES[token];
}

export function processTransactions(nativeData, tokenData, targetAddress) {
  // 1. Merge both arrays
  // 2. Filter incoming only (to === targetAddress)
  // 3. Filter < $10 USD
  // 4. Sort by timestamp desc
  // 5. Format fields (fromShort, arbiscanUrl, etc.)
  // 6. Return processed array
}

export function calculateStats(transactions) {
  // Calculate total, last 30 days, avg, monthly breakdown
}
```

### Environment Variables
```env
ARBISCAN_API_KEY=your_api_key_here
NEXT_PUBLIC_TEST_WALLET_ADDRESS=0x1C969652D758f8Fc23C443758f8911086F676216
```

---

## Success Criteria

### v0 is successful if:
1. ✅ API fetches real transactions from Arbiscan
2. ✅ Trader profile page shows real data (no errors)
3. ✅ Stats are calculated correctly
4. ✅ Transaction table links to Arbiscan correctly
5. ✅ Team can manually verify a few transactions match Arbiscan

### Acceptable trade-offs for v0:
- ⚠️ USD values are estimates (using $2500 ETH constant)
- ⚠️ No caching (may be slow, may hit rate limits)
- ⚠️ Errors will crash the page (that's OK, we'll see them)
- ⚠️ Page load time may be 3-5 seconds (acceptable for testing)

---

## Timeline

**Total: 2-3 days**

### Day 1: API Development
- TICKET-001: Environment setup (30 mins)
- TICKET-002: Arbiscan API helper (`lib/arbiscan.js`) (2 hours)
- TICKET-003: Transaction processor (`lib/transactionProcessor.js`) (2 hours)
- TICKET-004: API route (`app/api/transactions/route.js`) (1.5 hours)

### Day 2: Frontend Integration
- TICKET-005: React hook (`lib/hooks/useTransactions.js`) (1 hour)
- TICKET-006: Update trader profile - stats cards (1 hour)
- TICKET-007: Update trader profile - transaction table (1.5 hours)
- TICKET-008: Update trader profile - monthly chart (1 hour)

### Day 3: Testing
- TICKET-009: Manual testing & bug fixes (2 hours)
- TICKET-010: Code cleanup & documentation (1 hour)

---

## Technical Debt for Phase 1

⚠️ **Must fix before production:**
1. **Historical USD prices** - Replace constants with CoinGecko API
2. **Caching** - Add 5-minute cache to reduce API calls
3. **Error handling** - Retry logic, fallbacks, user-friendly errors
4. **Rate limiting** - Handle Arbiscan rate limits gracefully
5. **Performance** - Optimize load times if needed

---

## Risk Mitigation

### How we handle risks in v0:
- **Arbiscan rate limits?** → Accept errors, add caching in Phase 1
- **Inaccurate USD prices?** → Accept estimates ($2500 ETH), fix in Phase 1
- **API failures?** → Show error message, investigate
- **Too slow?** → Accept 3-5 second load times for v0 testing

---

## Notes
- Test wallet: `0x1C969652D758f8Fc23C443758f8911086F676216`
- Arbiscan API docs: https://docs.arbiscan.io/
- This is **NOT production-ready** - it's a quick prototype to validate the concept
- Goal is to see if real blockchain data makes sense for our use case
