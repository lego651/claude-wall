# PropVerified v0 - Technical Tickets

## Project Setup & Configuration

### TICKET-001: Environment Setup
**Priority:** P0 (Blocker)
**Estimate:** 30 mins
**Type:** Setup

**Description:**
Set up environment variables and API keys for Arbiscan and CoinGecko.

**Tasks:**
- [ ] Sign up for Arbiscan API key (free tier)
- [ ] Add `ARBISCAN_API_KEY` to `.env.local`
- [ ] Add `NEXT_PUBLIC_TEST_WALLET_ADDRESS=0x1C969652D758f8Fc23C443758f8911086F676216` to `.env.local`
- [ ] Update `.env.example` with new variables
- [ ] Verify Arbiscan API works with a test request

**Acceptance Criteria:**
- Can make successful API calls to Arbiscan
- Environment variables load correctly in Next.js

**Dependencies:** None

---

### TICKET-002: Install Required Dependencies
**Priority:** P0 (Blocker)
**Estimate:** 15 mins
**Type:** Setup

**Description:**
Install any additional npm packages needed for blockchain integration.

**Tasks:**
- [ ] Check if `ethers` or `viem` is needed (likely NOT needed for v0, just HTTP calls)
- [ ] Install `axios` if not already present (for API calls)
- [ ] Verify `recharts` is installed (for charts - should already exist)
- [ ] Run `npm install` and verify no conflicts

**Acceptance Criteria:**
- All dependencies installed
- `npm run dev` works without errors

**Dependencies:** None

---

## API Development

### TICKET-003: Create Arbiscan API Helper
**Priority:** P0 (Blocker)
**Estimate:** 2 hours
**Type:** Backend

**Description:**
Create utility functions to fetch transaction data from Arbiscan API.

**File:** `lib/arbiscan.js`

**Tasks:**
- [ ] Create `fetchNativeTransactions(address)` function
  - Endpoint: `https://api.arbiscan.io/api?module=account&action=txlist&address={address}&sort=desc`
  - Parse response and extract relevant fields
  - Handle pagination if needed (start with first 100)
- [ ] Create `fetchTokenTransactions(address)` function
  - Endpoint: `https://api.arbiscan.io/api?module=account&action=tokentx&address={address}&sort=desc`
  - Support USDC and USDT specifically
- [ ] Create error handling wrapper
- [ ] Add rate limit handling (exponential backoff)
- [ ] Add request logging for debugging

**Acceptance Criteria:**
- Functions return parsed transaction arrays
- Error handling catches API failures gracefully
- Console logs show clear debug info

**Dependencies:** TICKET-001

**Reference:**
- Arbiscan API Docs: https://docs.arbiscan.io/

---

### TICKET-004: Create Price Conversion Helper
**Priority:** P0 (Blocker)
**Estimate:** 2 hours
**Type:** Backend

**Description:**
Create utility to convert crypto amounts to USD using historical prices.

**File:** `lib/priceConverter.js`

**Tasks:**
- [ ] Create `getHistoricalPrice(token, timestamp)` function
  - Use CoinGecko API: `/api/v3/coins/{id}/history?date={DD-MM-YYYY}`
  - Support ETH, USDC, USDT
  - Cache prices by date to reduce API calls
- [ ] Create `convertToUSD(amount, token, timestamp)` function
  - Handle decimal precision correctly
  - Return formatted USD value
- [ ] Implement in-memory cache for prices (Map object)
- [ ] Add fallback prices if API fails (hardcoded reasonable values)
- [ ] Handle stablecoins (USDC/USDT = $1.00)

**Acceptance Criteria:**
- Converts ETH to USD accurately (within 5% of actual historical price)
- Stablecoins always return ~$1.00
- Caching reduces duplicate API calls
- Graceful fallback if CoinGecko is down

**Dependencies:** TICKET-001

**Reference:**
- CoinGecko API Docs: https://www.coingecko.com/en/api/documentation

---

### TICKET-005: Create Transaction Processing Logic
**Priority:** P0 (Blocker)
**Estimate:** 3 hours
**Type:** Backend

**Description:**
Process raw blockchain transactions into structured payout data.

**File:** `lib/transactionProcessor.js`

**Tasks:**
- [ ] Create `processTransactions(nativeData, tokenData)` function
  - Merge native ETH and ERC-20 transactions
  - Filter only incoming transactions (to === targetAddress)
  - Filter out transactions < $10 USD
  - Sort by timestamp (descending)
- [ ] Create `calculateStats(transactions)` function
  - Total transaction count
  - Total payout (USD)
  - Last 30 days payout (USD)
  - Last 30 days count
  - Average payout
- [ ] Create `groupByMonth(transactions)` function
  - For chart data (last 6 months)
  - Return array of {month, amount}
- [ ] Add transaction formatting
  - Shorten addresses (0x1234...5678)
  - Format USD with commas
  - Add Arbiscan URL for each transaction

**Acceptance Criteria:**
- Transactions are correctly filtered and sorted
- Stats calculations are accurate
- Monthly grouping works for chart visualization
- All transactions have properly formatted fields

**Dependencies:** TICKET-003, TICKET-004

---

### TICKET-006: Create API Route with Caching
**Priority:** P0 (Blocker)
**Estimate:** 2 hours
**Type:** Backend

**Description:**
Implement the main API endpoint with caching to avoid rate limits.

**File:** `app/api/transactions/route.js`

**Tasks:**
- [ ] Create `GET` handler for `/api/transactions?address={address}`
- [ ] Implement in-memory cache (Map with TTL)
  - Cache key: `transactions:${address}`
  - TTL: 5 minutes
- [ ] Chain all helper functions:
  1. Check cache first
  2. Fetch from Arbiscan if cache miss
  3. Convert to USD
  4. Process and calculate stats
  5. Store in cache
  6. Return JSON response
- [ ] Add error handling and return proper HTTP status codes
  - 200: Success
  - 400: Invalid address
  - 500: API error
- [ ] Add request logging

**Response Schema:**
```json
{
  "address": "string",
  "totalTransactions": "number",
  "totalPayoutUSD": "number",
  "last30DaysPayoutUSD": "number",
  "last30DaysCount": "number",
  "avgPayoutUSD": "number",
  "transactions": [
    {
      "txHash": "string",
      "timestamp": "number",
      "date": "ISO string",
      "from": "string",
      "fromShort": "string",
      "to": "string",
      "amount": "string",
      "amountUSD": "number",
      "token": "string",
      "tokenAddress": "string | null",
      "blockNumber": "number",
      "status": "string",
      "arbiscanUrl": "string"
    }
  ],
  "monthlyData": [
    {"month": "Jan", "amount": 4500}
  ]
}
```

**Acceptance Criteria:**
- API endpoint returns correct data structure
- Caching works (second request is fast)
- Error handling returns meaningful messages
- API response time < 3 seconds (first call), < 100ms (cached)

**Dependencies:** TICKET-003, TICKET-004, TICKET-005

---

## Frontend Integration

### TICKET-007: Create API Client Hook
**Priority:** P1
**Estimate:** 1 hour
**Type:** Frontend

**Description:**
Create React hook to fetch transaction data from API.

**File:** `lib/hooks/useTransactions.js`

**Tasks:**
- [ ] Create `useTransactions(address)` custom hook
  - Use `useEffect` to fetch on mount
  - Return `{ data, loading, error }` state
- [ ] Handle loading and error states
- [ ] Add retry logic (1 retry on failure)
- [ ] Cache results in component state

**Acceptance Criteria:**
- Hook fetches data successfully
- Loading state works
- Error state displays meaningful message
- No unnecessary re-fetches

**Dependencies:** TICKET-006

---

### TICKET-008: Update Trader Profile Page - Stats Cards
**Priority:** P1
**Estimate:** 1 hour
**Type:** Frontend

**Description:**
Replace mock data in stat cards with real API data.

**File:** `app/trader/[handle]/page.js`

**Tasks:**
- [ ] Import `useTransactions` hook
- [ ] Hardcode test wallet address (or get from env)
- [ ] Replace mock data in three stat cards:
  - Total Verified (use `totalPayoutUSD`)
  - Last 30 Days (use `last30DaysPayoutUSD`)
  - Avg Payout (use `avgPayoutUSD`)
- [ ] Add loading skeleton for stat cards
- [ ] Handle error state (show error message)
- [ ] Update payout count display

**Acceptance Criteria:**
- Stats display real data from API
- Numbers are formatted correctly (commas, decimals)
- Loading state shows skeletons
- Error state is user-friendly

**Dependencies:** TICKET-007

---

### TICKET-009: Update Trader Profile Page - Transaction Table
**Priority:** P1
**Estimate:** 2 hours
**Type:** Frontend

**Description:**
Replace mock transaction table with real blockchain data.

**File:** `app/trader/[handle]/page.js`

**Tasks:**
- [ ] Update table body to map over `data.transactions`
- [ ] Display fields:
  - Date (formatted as "Jan 15, 2024")
  - From address (use `fromShort`)
  - Tx Hash (link to `arbiscanUrl`, show shortened hash)
  - Amount (USD formatted)
- [ ] Remove "Firm" column (we don't identify firms in v0)
- [ ] Add loading skeleton for table rows
- [ ] Handle empty state (no transactions)
- [ ] Keep "Load older transactions" button (non-functional for v0)

**Acceptance Criteria:**
- Table displays real transactions
- Links to Arbiscan work correctly
- Addresses and hashes are properly shortened
- USD amounts are formatted with $ and commas
- Empty state shows helpful message

**Dependencies:** TICKET-007

---

### TICKET-010: Update Trader Profile Page - Monthly Chart
**Priority:** P1
**Estimate:** 1.5 hours
**Type:** Frontend

**Description:**
Update monthly payout chart with real transaction data.

**File:** `app/trader/[handle]/page.js`

**Tasks:**
- [ ] Replace mock `chartData` with `data.monthlyData`
- [ ] Ensure data format matches Recharts requirements
- [ ] Update chart to show last 6 months of data
- [ ] Handle months with zero payouts (show $0 bar)
- [ ] Add loading skeleton for chart
- [ ] Verify chart colors and styling match design

**Acceptance Criteria:**
- Chart displays real monthly data
- Empty months show as $0
- Chart is responsive and renders correctly
- Loading state works
- Tooltip shows correct USD values

**Dependencies:** TICKET-007

---

### TICKET-011: Update Sidebar - Verified Firms Section
**Priority:** P2 (Nice to have)
**Estimate:** 30 mins
**Type:** Frontend

**Description:**
Update or remove the "Verified Firms" sidebar section.

**File:** `app/trader/[handle]/page.js`

**Tasks:**
- [ ] Option A: Remove this section entirely (since we don't identify firms in v0)
- [ ] Option B: Show placeholder message like "Firm mapping coming soon"
- [ ] Option C: Keep mock data as visual placeholder

**Acceptance Criteria:**
- Section is either removed or has clear messaging

**Dependencies:** None

---

## Testing & Quality Assurance

### TICKET-012: Manual Testing - API Endpoints
**Priority:** P0
**Estimate:** 1 hour
**Type:** QA

**Description:**
Manually test API endpoints with various scenarios.

**Tasks:**
- [ ] Test with valid wallet address (test address)
- [ ] Test with invalid wallet address (should return 400)
- [ ] Test with address that has no transactions
- [ ] Verify caching works (check logs for cache hits)
- [ ] Verify USD conversions are accurate (spot check 3-5 transactions)
- [ ] Test API error scenarios (turn off internet, test timeout)
- [ ] Check API response time (should be < 3s)

**Acceptance Criteria:**
- All test cases pass
- No console errors
- Response times are acceptable
- USD values are accurate (within 5% margin)

**Dependencies:** TICKET-006

---

### TICKET-013: Manual Testing - UI Integration
**Priority:** P0
**Estimate:** 1 hour
**Type:** QA

**Description:**
Test trader profile page with real data.

**Tasks:**
- [ ] Visit `/trader/thefundedlady` (or whatever handle we use)
- [ ] Verify all stats display correctly
- [ ] Verify transaction table loads and displays data
- [ ] Click Arbiscan links (should open correct transaction)
- [ ] Verify monthly chart renders with real data
- [ ] Test loading states (throttle network in DevTools)
- [ ] Test error states (stop dev server, check error handling)
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

**Acceptance Criteria:**
- All UI elements render correctly
- No console errors or warnings
- Responsive design works
- Links work correctly
- Loading and error states function properly

**Dependencies:** TICKET-008, TICKET-009, TICKET-010

---

### TICKET-014: Code Review & Cleanup
**Priority:** P1
**Estimate:** 1 hour
**Type:** QA

**Description:**
Review all code, clean up console logs, and ensure code quality.

**Tasks:**
- [ ] Remove unnecessary console.logs (keep only error logs)
- [ ] Add comments to complex functions
- [ ] Ensure consistent code formatting
- [ ] Check for unused imports
- [ ] Verify all environment variables are documented in `.env.example`
- [ ] Add basic JSDoc comments to key functions
- [ ] Run `npm run lint` and fix any issues
- [ ] Run `npm run build` and verify no warnings

**Acceptance Criteria:**
- Code is clean and well-commented
- No lint errors
- Build succeeds without warnings
- `.env.example` is up to date

**Dependencies:** All previous tickets

---

## Documentation

### TICKET-015: Create v0 Testing Guide
**Priority:** P2
**Estimate:** 30 mins
**Type:** Documentation

**Description:**
Create simple guide for team to test v0.

**File:** `roadmap/v0_testing_guide.md`

**Tasks:**
- [ ] Document how to set up environment variables
- [ ] List steps to run the app locally
- [ ] Provide test scenarios (what to check)
- [ ] Include test wallet address
- [ ] Add troubleshooting tips (common errors)
- [ ] Include links to Arbiscan for manual verification

**Acceptance Criteria:**
- Non-technical team member can follow guide and test the app
- All steps are clear and accurate

**Dependencies:** TICKET-014

---

## Summary

### Ticket Count: 15 tickets
- **P0 (Blocker):** 9 tickets
- **P1 (High):** 5 tickets
- **P2 (Nice to have):** 2 tickets

### Total Estimate: ~20 hours (~1 week)
- **Setup:** 1 hour
- **Backend/API:** 9 hours
- **Frontend:** 6 hours
- **Testing:** 2 hours
- **Documentation:** 0.5 hours
- **Buffer:** 1.5 hours

### Critical Path:
1. TICKET-001 ’ TICKET-002 (Setup)
2. TICKET-003 ’ TICKET-004 ’ TICKET-005 ’ TICKET-006 (API Development)
3. TICKET-007 ’ TICKET-008, 009, 010 (Frontend Integration)
4. TICKET-012, 013, 014 (Testing & QA)
5. TICKET-015 (Documentation)

### Parallel Work Opportunities:
- TICKET-003 and TICKET-004 can be developed in parallel
- TICKET-008, 009, 010, 011 can be worked on in parallel once TICKET-007 is done

---

## Development Workflow

### Sprint Plan (5 days):
**Day 1:** TICKET-001, 002, 003, 004
**Day 2:** TICKET-005, 006
**Day 3:** TICKET-007, 008, 009, 010
**Day 4:** TICKET-011, 012, 013
**Day 5:** TICKET-014, 015 + Buffer

### Definition of Done:
- Code is written and tested
- No console errors or warnings
- `npm run build` succeeds
- Manual testing completed
- Code reviewed and cleaned up
- Merged to main branch
