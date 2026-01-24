# Trader Cache Setup Guide

This document explains the trader caching system that avoids Arbiscan API rate limits and issues.

## Overview

Instead of calling Arbiscan API directly for each trader wallet, we now:
1. Cache trader transaction statistics in Supabase `trader_records` table
2. Sync data every 30 minutes via GitHub Actions
3. APIs read from cache first, only fallback to Arbiscan if cache is stale

## Database Setup

### 1. Create the `trader_records` table

Run the migration script in Supabase SQL Editor:

```sql
-- See: database/create-trader-records-table.sql
```

This creates:
- `trader_records` table with aggregated stats
- Indexes for performance
- RLS policies (public read, service write)

## Sync Service

### 2. Trader Sync Service

The sync service (`lib/services/traderSyncService.js`) provides:
- `syncTraderWallet()` - Sync single wallet
- `syncAllTraders()` - Sync all wallets from profiles
- `cleanupOrphanedRecords()` - Cleanup old records

### 3. GitHub Actions Workflow

The workflow (`.github/workflows/sync-traders.yml`) runs every 30 minutes:
- Fetches all profiles with wallet addresses
- Syncs each wallet's transaction data from Arbiscan
- Updates `trader_records` table
- Cleans up orphaned records

## API Changes

### `/api/transactions`
- **Before**: Always called Arbiscan API
- **After**: Checks cache first, only calls Arbiscan if cache is stale (>30 mins) or missing

### `/api/leaderboard`
- **Before**: Returned profiles only, stats calculated client-side
- **After**: Returns profiles with cached stats from `trader_records` table

## Frontend Changes

### Leaderboard Page
- **Before**: Fetched transaction stats client-side for each trader
- **After**: Uses cached stats directly from API (no client-side Arbiscan calls)

## Benefits

1. **Reduced API Calls**: Arbiscan only called during sync (every 30 mins), not on every page load
2. **Faster Response**: Cached data returns instantly
3. **Rate Limit Protection**: Sync job handles rate limiting, not user requests
4. **Resilience**: If Arbiscan is down, cached data still available

## Monitoring

Check sync status:
- GitHub Actions: `.github/workflows/sync-traders.yml` runs every 30 minutes
- Supabase: Check `trader_records.last_synced_at` to see when data was last updated
- Errors: Check `trader_records.sync_error` for failed syncs

## Manual Sync

To manually trigger a sync:
1. Go to GitHub Actions
2. Find "Sync Traders (Real-time)" workflow
3. Click "Run workflow"

Or run locally:
```bash
node scripts/sync-traders-to-supabase.js
```

## Troubleshooting

### Cache not updating
- Check GitHub Actions workflow is running
- Verify `ARBISCAN_API_KEY` is set in GitHub Secrets
- Check `trader_records.sync_error` for error messages

### Stale data
- Cache is considered fresh for 30 minutes
- If cache is stale, API will fallback to Arbiscan
- Sync job runs every 30 minutes to refresh cache

### Missing traders
- Only traders with `wallet_address` in profiles table are synced
- Ensure users have linked their wallet addresses
