# PropProof v2 - Implementation Tickets

> **Reference:** [PROPFIRM_API_DESIGN.md](/documents/PROPFIRM_API_DESIGN.md)  
> **Created:** January 20, 2026

---

## Overview

This document breaks down the PropProof v2 feature into actionable tickets organized by phase.

### Phases

| Phase | Focus | Tickets |
|-------|-------|---------|
| 1 | Database Setup | PP2-001 to PP2-003 |
| 2 | Sync Infrastructure | PP2-004 to PP2-007 |
| 3 | API Endpoints | PP2-008 to PP2-012 |
| 4 | Frontend Updates | PP2-013 to PP2-017 |
| 5 | Testing & Polish | PP2-018 to PP2-020 |

---

## Phase 1: Database Setup

### PP2-001: Create Supabase `firms` Table

**Priority:** High  
**Estimate:** 1 hour  
**Dependencies:** None

**Description:**
Create the `firms` table in Supabase to store prop firm metadata and latest payout information.

**Acceptance Criteria:**
- [ ] Table created with all columns from schema
- [ ] Indexes created for query performance
- [ ] RLS policies configured (public read, service write)
- [ ] Seed data inserted for existing firms (from `data/propfirms.json`)

**Schema:**
```sql
CREATE TABLE firms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  website TEXT,
  addresses TEXT[] NOT NULL,
  last_payout_at TIMESTAMPTZ,
  last_payout_amount DECIMAL(18,2),
  last_payout_tx_hash TEXT,
  last_payout_method TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### PP2-002: Create Supabase `recent_payouts` Table

**Priority:** High  
**Estimate:** 1 hour  
**Dependencies:** PP2-001

**Description:**
Create the `recent_payouts` table to store the rolling 24-hour window of transactions.

**Acceptance Criteria:**
- [ ] Table created with all columns from schema
- [ ] Foreign key to `firms` table
- [ ] Indexes created: `(firm_id, timestamp DESC)`, `(timestamp DESC)`, `(firm_id, amount DESC)`
- [ ] RLS policies configured

**Schema:**
```sql
CREATE TABLE recent_payouts (
  tx_hash TEXT PRIMARY KEY,
  firm_id TEXT REFERENCES firms(id) ON DELETE CASCADE,
  amount DECIMAL(18,2) NOT NULL,
  payment_method TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### PP2-003: Migrate Existing Firm Data to Supabase

**Priority:** High  
**Estimate:** 30 min  
**Dependencies:** PP2-001

**Description:**
Migrate existing firm data from `data/propfirms.json` to the new Supabase `firms` table.

**Acceptance Criteria:**
- [ ] All firms from JSON file inserted into Supabase
- [ ] Wallet addresses correctly formatted as arrays
- [ ] Verify data integrity after migration

---

## Phase 2: Sync Infrastructure

### PP2-004: Create Sync Service Module

**Priority:** High  
**Estimate:** 3 hours  
**Dependencies:** PP2-001, PP2-002

**Description:**
Create a reusable sync service that fetches transactions from Arbiscan and updates Supabase.

**File:** `lib/services/payoutSyncService.js`

**Acceptance Criteria:**
- [ ] Function to fetch transactions for a single firm
- [ ] Function to process and filter outgoing transactions
- [ ] Function to upsert transactions to `recent_payouts`
- [ ] Function to update `firms.last_payout_*` fields
- [ ] Function to cleanup old transactions (>24h)
- [ ] Error handling with retry logic
- [ ] Logging for debugging

**Functions:**
```javascript
export async function syncFirmPayouts(firmId, addresses)
export async function updateFirmLastPayout(firmId, latestTx)
export async function cleanupOldPayouts(hoursToKeep = 24)
export async function syncAllFirms()
```

---

### PP2-005: Create Vercel Cron Endpoint

**Priority:** High  
**Estimate:** 2 hours  
**Dependencies:** PP2-004

**Description:**
Create a cron endpoint that Vercel can call every 10 minutes to sync payout data.

**File:** `app/api/cron/sync-payouts/route.js`

**Acceptance Criteria:**
- [ ] Endpoint protected with `CRON_SECRET` header verification
- [ ] Calls `syncAllFirms()` from sync service
- [ ] Returns success/failure status with stats
- [ ] Handles timeouts gracefully (Vercel 10s limit for hobby)
- [ ] Add to `vercel.json` cron config

**Vercel Config:**
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-payouts",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

### PP2-006: Create JSON Archive Script

**Priority:** Medium  
**Estimate:** 3 hours  
**Dependencies:** PP2-004

**Description:**
Create a Node.js script that archives historical payout data to JSON files.

**File:** `scripts/archive-payouts.js`

**Acceptance Criteria:**
- [ ] Fetches all transactions for a given month from Arbiscan
- [ ] Groups by firm and generates monthly JSON files
- [ ] Computes daily buckets and summary stats
- [ ] Generates `_aggregates/{month}.json` files
- [ ] Idempotent (can re-run without duplicates)
- [ ] CLI interface: `node scripts/archive-payouts.js --month 2025-12`

**Output Structure:**
```
/data/payouts/
├── _aggregates/2025-12.json
├── fundednext/2025-12.json
└── myfundedfutures/2025-12.json
```

---

### PP2-007: Create GitHub Action for Weekly Archive

**Priority:** Low  
**Estimate:** 1 hour  
**Dependencies:** PP2-006

**Description:**
Set up a GitHub Action that runs the archive script weekly and commits the JSON files.

**File:** `.github/workflows/archive-payouts.yml`

**Acceptance Criteria:**
- [ ] Runs every Sunday at midnight UTC
- [ ] Executes archive script for previous week
- [ ] Commits and pushes JSON files to repo
- [ ] Sends notification on failure (optional)

---

## Phase 3: API Endpoints

### PP2-008: Implement `GET /api/v2/propfirms` (List)

**Priority:** High  
**Estimate:** 3 hours  
**Dependencies:** PP2-001, PP2-002

**Description:**
Implement the list endpoint that returns all firms with aggregated metrics.

**File:** `app/api/v2/propfirms/route.js`

**Acceptance Criteria:**
- [ ] Accepts query params: `period`, `sort`, `order`
- [ ] For `1d`/`7d`: Query `recent_payouts` and aggregate
- [ ] For `30d`/`12m`: Merge Supabase + JSON files
- [ ] `latestPayoutAt` comes from `firms.last_payout_at`
- [ ] Sorting works correctly for all fields
- [ ] Response matches API design spec

**Test Cases:**
- [ ] `?period=1d` returns correct 24h metrics
- [ ] `?period=12m` correctly merges JSON data
- [ ] `?sort=payoutCount&order=asc` sorts correctly

---

### PP2-009: Implement `GET /api/v2/propfirms/[id]/chart`

**Priority:** High  
**Estimate:** 3 hours  
**Dependencies:** PP2-008

**Description:**
Implement the chart endpoint with summary stats and bucketed data.

**File:** `app/api/v2/propfirms/[id]/chart/route.js`

**Acceptance Criteria:**
- [ ] Accepts query param: `period` (30d or 12m)
- [ ] For `30d`: Returns 30 daily buckets
- [ ] For `12m`: Returns 12 monthly buckets
- [ ] Each bucket has: total, rise, crypto, wire
- [ ] Summary includes: totalPayouts, payoutCount, largestPayout, avgPayout, latestPayoutAt
- [ ] Firm metadata included in response

**Test Cases:**
- [ ] `?period=30d` returns 30 daily data points
- [ ] `?period=12m` returns 12 monthly data points
- [ ] Bucket totals match sum of payment methods

---

### PP2-010: Implement `GET /api/v2/propfirms/[id]/top-payouts`

**Priority:** Medium  
**Estimate:** 2 hours  
**Dependencies:** PP2-008

**Description:**
Implement the top payouts endpoint returning the 10 largest payouts.

**File:** `app/api/v2/propfirms/[id]/top-payouts/route.js`

**Acceptance Criteria:**
- [ ] Accepts query param: `period` (30d or 12m)
- [ ] Returns top 10 sorted by amount descending
- [ ] Each payout includes: id, date, amount, paymentMethod, txHash, arbiscanUrl
- [ ] For `30d`: Merge Supabase + JSON, re-sort
- [ ] For `12m`: Load from JSON files only

---

### PP2-011: Implement `GET /api/v2/propfirms/[id]/latest-payouts`

**Priority:** High  
**Estimate:** 1.5 hours  
**Dependencies:** PP2-002

**Description:**
Implement the real-time latest payouts endpoint.

**File:** `app/api/v2/propfirms/[id]/latest-payouts/route.js`

**Acceptance Criteria:**
- [ ] No query params (always returns top 20)
- [ ] Queries `recent_payouts` table directly
- [ ] Sorted by timestamp descending
- [ ] Returns timestamp (not computed timeSince - client handles this)
- [ ] Returns count of results

---

### PP2-012: Create Shared Data Loader Utilities

**Priority:** Medium  
**Estimate:** 2 hours  
**Dependencies:** PP2-006

**Description:**
Create utility functions for loading and merging JSON files with Supabase data.

**File:** `lib/services/payoutDataLoader.js`

**Acceptance Criteria:**
- [ ] Function to load monthly JSON file for a firm
- [ ] Function to load aggregate JSON file
- [ ] Function to merge Supabase data with JSON data
- [ ] Function to compute period-based aggregates
- [ ] Caching for frequently accessed files (optional)

**Functions:**
```javascript
export async function loadMonthlyData(firmId, yearMonth)
export async function loadAggregates(yearMonth)
export async function mergePayoutData(supabaseData, jsonData)
export async function computeMetrics(transactions, period)
```

---

## Phase 4: Frontend Updates

### PP2-013: Create `timeSince` Client Utility

**Priority:** High  
**Estimate:** 30 min  
**Dependencies:** None

**Description:**
Create a client-side utility for computing human-readable time since a timestamp.

**File:** `lib/utils/timeSince.js`

**Acceptance Criteria:**
- [ ] Returns "X minutes" for < 1 hour
- [ ] Returns "X hours and Y minutes" for < 24 hours
- [ ] Returns "Xd Yhr" for > 24 hours
- [ ] Handles edge cases (null, undefined, future dates)

---

### PP2-014: Update Prop Firm List Page

**Priority:** High  
**Estimate:** 4 hours  
**Dependencies:** PP2-008, PP2-013

**Description:**
Update the list page to use the new v2 API and add period selector.

**File:** `app/propfirms/page.js` (or new page)

**Acceptance Criteria:**
- [ ] Period selector tabs: 1d, 7d, 30d, 12m
- [ ] Table displays: Firm, Total Payouts, No. of Payouts, Largest Payout, Avg Payout, Latest Payout
- [ ] Sortable columns (click header to sort)
- [ ] `timeSince` computed client-side for "Latest Payout"
- [ ] Loading state while fetching
- [ ] Click row to navigate to detail page

---

### PP2-015: Update Prop Firm Detail Page - Summary Cards

**Priority:** High  
**Estimate:** 2 hours  
**Dependencies:** PP2-009, PP2-013

**Description:**
Update the detail page summary cards to use v2 API data.

**File:** `app/propfirm/[id]/page.js`

**Acceptance Criteria:**
- [ ] Cards show: Total Payouts, No. of Payouts, Largest Payout, Time Since Last Payout
- [ ] `timeSince` updates dynamically (or on re-render)
- [ ] Values come from chart endpoint summary
- [ ] Period selector affects summary values

---

### PP2-016: Update Prop Firm Detail Page - Chart

**Priority:** High  
**Estimate:** 3 hours  
**Dependencies:** PP2-009

**Description:**
Update the chart component to use v2 API with period switching.

**File:** `app/propfirm/[id]/page.js`

**Acceptance Criteria:**
- [ ] Period selector: Last 30 Days, Last 12 Months
- [ ] Chart renders daily buckets for 30d
- [ ] Chart renders monthly buckets for 12m
- [ ] Stacked bars for Rise/Crypto/Wire
- [ ] Loading state during period switch
- [ ] X-axis labels adapt to bucket type

---

### PP2-017: Update Prop Firm Detail Page - Payout Lists

**Priority:** High  
**Estimate:** 2 hours  
**Dependencies:** PP2-010, PP2-011

**Description:**
Update the Top 10 and Latest Payouts sections.

**File:** `app/propfirm/[id]/page.js`

**Acceptance Criteria:**
- [ ] Top 10: Shows largest payouts for selected period
- [ ] Top 10: Updates when period changes
- [ ] Latest Payouts: Shows top 20 most recent
- [ ] Latest Payouts: `timeSince` computed client-side
- [ ] Both lists link to Arbiscan
- [ ] Empty states handled gracefully

---

## Phase 5: Testing & Polish

### PP2-018: Add Error Handling and Edge Cases

**Priority:** Medium  
**Estimate:** 2 hours  
**Dependencies:** All API endpoints

**Description:**
Add comprehensive error handling across all endpoints and UI.

**Acceptance Criteria:**
- [ ] API returns proper error codes (400, 404, 500)
- [ ] UI shows error messages when API fails
- [ ] Empty states for firms with no payouts
- [ ] Handle missing JSON files gracefully
- [ ] Timeout handling for slow queries

---

### PP2-019: Add Loading States and Optimistic UI

**Priority:** Medium  
**Estimate:** 2 hours  
**Dependencies:** Phase 4

**Description:**
Improve perceived performance with loading states and skeleton UI.

**Acceptance Criteria:**
- [ ] Skeleton loaders for list page table
- [ ] Skeleton loaders for detail page cards
- [ ] Chart shows loading indicator during data fetch
- [ ] Smooth transitions when period changes

---

### PP2-020: Manual Testing and Bug Fixes

**Priority:** High  
**Estimate:** 3 hours  
**Dependencies:** All tickets

**Description:**
Comprehensive manual testing of all features.

**Test Checklist:**
- [ ] List page: All period filters work
- [ ] List page: Sorting works for all columns
- [ ] List page: Click through to detail works
- [ ] Detail page: Summary cards show correct data
- [ ] Detail page: Chart renders correctly for 30d and 12m
- [ ] Detail page: Top 10 updates with period
- [ ] Detail page: Latest Payouts shows real-time data
- [ ] Sync job: Manually trigger and verify data updates
- [ ] Edge case: Firm with no payouts in 24h
- [ ] Edge case: New firm with no historical data
- [ ] Mobile: Responsive layout works

---

## Ticket Summary

| Phase | Ticket | Title | Priority | Estimate |
|-------|--------|-------|----------|----------|
| 1 | PP2-001 | Create Supabase `firms` Table | High | 1h |
| 1 | PP2-002 | Create Supabase `recent_payouts` Table | High | 1h |
| 1 | PP2-003 | Migrate Existing Firm Data | High | 30m |
| 2 | PP2-004 | Create Sync Service Module | High | 3h |
| 2 | PP2-005 | Create Vercel Cron Endpoint | High | 2h |
| 2 | PP2-006 | Create JSON Archive Script | Medium | 3h |
| 2 | PP2-007 | GitHub Action for Weekly Archive | Low | 1h |
| 3 | PP2-008 | Implement List API | High | 3h |
| 3 | PP2-009 | Implement Chart API | High | 3h |
| 3 | PP2-010 | Implement Top Payouts API | Medium | 2h |
| 3 | PP2-011 | Implement Latest Payouts API | High | 1.5h |
| 3 | PP2-012 | Create Data Loader Utilities | Medium | 2h |
| 4 | PP2-013 | Create timeSince Utility | High | 30m |
| 4 | PP2-014 | Update List Page | High | 4h |
| 4 | PP2-015 | Update Detail - Summary Cards | High | 2h |
| 4 | PP2-016 | Update Detail - Chart | High | 3h |
| 4 | PP2-017 | Update Detail - Payout Lists | High | 2h |
| 5 | PP2-018 | Error Handling | Medium | 2h |
| 5 | PP2-019 | Loading States | Medium | 2h |
| 5 | PP2-020 | Manual Testing | High | 3h |

**Total Estimate:** ~42 hours

---

## Suggested Sprint Plan

### Sprint 1 (Week 1): Foundation
- PP2-001, PP2-002, PP2-003 (Database)
- PP2-004, PP2-005 (Sync core)
- PP2-013 (timeSince utility)

### Sprint 2 (Week 2): APIs
- PP2-008, PP2-009, PP2-010, PP2-011, PP2-012 (All APIs)

### Sprint 3 (Week 3): Frontend
- PP2-014, PP2-015, PP2-016, PP2-017 (All UI updates)

### Sprint 4 (Week 4): Polish
- PP2-006, PP2-007 (Archive scripts)
- PP2-018, PP2-019, PP2-020 (Testing & polish)
