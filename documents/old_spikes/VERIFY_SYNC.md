# How to Verify Trader Sync is Working

This guide provides multiple ways to verify that the trader sync logic is working correctly.

## 1. Check Supabase Database Directly

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor** → `trader_records`
3. Check for records:
   - Should see rows with `wallet_address`, `total_payout_usd`, `last_synced_at`
   - `last_synced_at` should be recent (within last 30 minutes if sync is running)
   - `sync_error` should be `null` for successful syncs

### Using SQL Query

```sql
-- Check all trader records
SELECT 
  wallet_address,
  total_payout_usd,
  last_30_days_payout_usd,
  payout_count,
  last_synced_at,
  sync_error
FROM trader_records
ORDER BY last_synced_at DESC;

-- Check sync status
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN sync_error IS NULL THEN 1 END) as successful,
  COUNT(CASE WHEN sync_error IS NOT NULL THEN 1 END) as failed,
  MAX(last_synced_at) as last_sync_time
FROM trader_records;

-- Check profiles with wallet addresses (should match trader_records)
SELECT 
  p.id,
  p.wallet_address,
  p.display_name,
  tr.total_payout_usd,
  tr.last_synced_at
FROM profiles p
LEFT JOIN trader_records tr ON tr.wallet_address = LOWER(p.wallet_address)
WHERE p.wallet_address IS NOT NULL;
```

## 2. Run Sync Script Locally

### Prerequisites

Make sure you have the required environment variables:

```bash
export ARBISCAN_API_KEY="your-api-key"
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Run the Script

```bash
# From project root
node scripts/sync-traders-to-supabase.js
```

### Expected Output

```
🚀 Trader Sync Script (Supabase)
================================

[TraderSync] Starting full sync...
[TraderSync] Found X trader wallets to sync
[TraderSync] Starting sync for wallet: 0x...
[TraderSync] Processed Y new transactions (last 30d, not in JSON) for 0x...
[TraderSync] Successfully synced 0x...: $X,XXX total
[TraderSync] Complete! X/X wallets synced in XXXXms

================================
📋 Summary

  Wallets synced: X
  Successful: X
  Errors: 0
  Duration: XXXXms

✅ Sync complete!
```

## 3. Check GitHub Actions Workflow

### View Workflow Runs

1. Go to your GitHub repository
2. Click on **Actions** tab
3. Find **Sync Data (Real-time)** workflow
4. Check recent runs:
   - Should run every 30 minutes (cron: `*/30 * * * *`)
   - Status should be green (success)
   - Check logs for any errors

### Manual Trigger

1. Go to **Actions** → **Sync Data (Real-time)**
2. Click **Run workflow** button
3. Select branch (usually `main`)
4. Click **Run workflow**
5. Wait for completion and check logs

### Check Workflow Logs

Look for:
- ✅ "Sync completed at [timestamp]"
- ✅ "Wallets synced: X"
- ✅ "Successful: X"
- ❌ Any error messages

## 4. Test API Endpoints

### Leaderboard API

```bash
# Test the leaderboard endpoint
curl https://claude-wall.vercel.app/api/leaderboard | jq

# Or in browser
# https://claude-wall.vercel.app/api/leaderboard
```

**Expected Response:**
```json
{
  "traders": [
    {
      "id": "...",
      "displayName": "...",
      "handle": "...",
      "walletAddress": "0x...",
      "totalVerifiedPayout": 12345.67,
      "last30DaysPayout": 1234.56,
      "avgPayout": 123.45,
      "payoutCount": 100,
      "lastSyncedAt": "2026-01-24T12:00:00Z"
    }
  ]
}
```

### Transactions API (for specific wallet)

```bash
# Replace WALLET_ADDRESS with actual wallet
curl "https://claude-wall.vercel.app/api/transactions?wallet=WALLET_ADDRESS" | jq
```

## 5. Check Frontend Pages

### Leaderboard Page

1. Visit: https://claude-wall.vercel.app/leaderboard
2. Should show:
   - List of traders with verified payouts
   - Total verified payout amounts
   - 30-day change metrics
   - Rankings

### Dashboard Page

1. Visit: https://claude-wall.vercel.app/dashboard
2. Sign in with a user that has a wallet address
3. Should show:
   - Total verified payout
   - Last 30 days payout
   - Average payout
   - Transaction history
   - Monthly payout chart

## 6. Check JSON Files

### Local Development

```bash
# Check if trader JSON files exist
ls -la data/traders/

# Should see directories for each wallet address
# Example: data/traders/0x1234.../2026-01.json
```

### In Repository

1. Check GitHub repository
2. Navigate to `data/traders/` directory
3. Should see:
   - Directories named by wallet addresses (lowercase)
   - Monthly JSON files (e.g., `2026-01.json`)
   - Files updated daily via historical sync workflow

## 7. Verify Sync Logic Flow

### Expected Flow

1. **Every 30 minutes** (realtime sync):
   - Fetches all profiles with `wallet_address`
   - For each wallet:
     - Fetches transactions from Arbiscan (last 30 days)
     - Loads historical data from JSON files (if exists)
     - Combines: historical (JSON) + recent (Arbiscan)
     - Updates `trader_records` table in Supabase

2. **Daily at 11:00 UTC** (historical sync):
   - Updates current month's JSON file for each trader
   - Commits and pushes changes to repository

### Data Sources Priority

1. **JSON files** (if exist) → Historical data
2. **Arbiscan API** → Recent transactions (last 30 days)
3. **Supabase `trader_records`** → Cached stats

## 8. Common Issues & Solutions

### Issue: `trader_records` table is empty

**Check:**
- Are there profiles with `wallet_address` set?
- Did the sync script run successfully?
- Check `sync_error` column for errors

**Solution:**
```sql
-- Check if profiles have wallet addresses
SELECT COUNT(*) FROM profiles WHERE wallet_address IS NOT NULL;

-- If 0, need to add wallet addresses to profiles
```

### Issue: Sync script fails with import errors

**Check:**
- Are all dependencies installed? (`yarn install`)
- Are environment variables set correctly?

**Solution:**
- Fixed in latest code: Changed `@/` imports to relative paths
- Make sure you have latest code

### Issue: No data on frontend

**Check:**
- Is `trader_records` table populated?
- Are profiles public (have `display_name` and `handle`)?
- Check browser console for API errors

**Solution:**
- Run sync script manually
- Check API endpoint responses
- Verify RLS policies allow public read

### Issue: JSON files don't exist

**This is OK!** The sync works without JSON files:
- First sync calculates from all transactions
- JSON files are created daily by historical sync
- Realtime sync works independently

## 9. Quick Verification Checklist

- [ ] `trader_records` table has rows
- [ ] `last_synced_at` is recent (< 1 hour old)
- [ ] `sync_error` is `null` for all records
- [ ] Leaderboard API returns traders with data
- [ ] Dashboard shows transaction data
- [ ] GitHub Actions workflow runs successfully
- [ ] Sync script runs without errors locally
- [ ] JSON files exist (optional, created daily)

## 10. Debug Commands

```bash
# Check if profiles have wallet addresses
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('profiles')
  .select('id, wallet_address')
  .not('wallet_address', 'is', null)
  .then(({ data, error }) => {
    console.log('Profiles with wallets:', data?.length || 0);
    console.log(data);
  });
"

# Test single wallet sync
node -e "
const { syncTraderWallet } = require('./lib/services/traderSyncService.js');
syncTraderWallet('0xYOUR_WALLET_ADDRESS')
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => console.error(err));
"
```

## Next Steps

If sync is working:
- ✅ Data should appear on leaderboard within 30 minutes
- ✅ Dashboard should show transaction data
- ✅ JSON files will be created/updated daily

If sync is not working:
- Check error messages in sync logs
- Verify environment variables
- Check Supabase RLS policies
- Review GitHub Actions workflow logs
