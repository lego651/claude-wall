# GitHub Actions Setup for Payout Sync

This document explains how to set up GitHub Actions to replace the Vercel cron job for syncing payout data.

## Why GitHub Actions?

- **Vercel Hobby plan** only allows daily cron jobs
- **GitHub Actions** can run every 15 minutes (free tier: 2000 min/month)
- This gives us near real-time payout updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  sync-realtime.yml (every 15 min)                               │
│  ├── Fetch from Arbiscan                                        │
│  ├── Update Supabase `recent_payouts` table                     │
│  └── Used for: 1d, 7d period data                               │
│                                                                  │
│  sync-historical.yml (daily at 3 AM PST)                        │
│  ├── Fetch current month from Arbiscan                          │
│  ├── Update JSON files in data/payouts/                         │
│  ├── Commit and push to main                                    │
│  ├── Vercel auto-deploys                                        │
│  └── Used for: 30d, 12m period data                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Add GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `ARBISCAN_API_KEY` | Your Arbiscan API key | Get from [arbiscan.io](https://arbiscan.io/myapikey) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | Service role key (not anon key!) |

### 2. Enable GitHub Actions

GitHub Actions should be enabled by default. If not:

1. Go to repository → Settings → Actions → General
2. Select "Allow all actions and reusable workflows"
3. Save

### 3. Verify Workflows

After pushing the workflow files, check:

1. Go to repository → Actions tab
2. You should see two workflows:
   - "Sync Payouts (Real-time)"
   - "Sync Payouts (Historical)"

### 4. Test Manually

You can trigger workflows manually:

1. Go to Actions → Select workflow
2. Click "Run workflow" → "Run workflow"
3. Check the logs for any errors

## Workflow Files

### `.github/workflows/sync-realtime.yml`

- **Schedule**: Every 15 minutes (`*/15 * * * *`)
- **Purpose**: Update Supabase with latest payouts
- **Script**: `scripts/sync-to-supabase.js`

### `.github/workflows/sync-historical.yml`

- **Schedule**: Daily at 3 AM PST / 11:00 UTC (`0 11 * * *`)
- **Purpose**: Update JSON files with current month data
- **Script**: `scripts/update-monthly-json.js`
- **Auto-commits**: Yes, pushes to main branch

## Scripts

### `scripts/sync-to-supabase.js`

Standalone Node.js script that:
1. Reads firm addresses from `data/propfirms.json`
2. Fetches last 24h transactions from Arbiscan
3. Upserts to Supabase `recent_payouts` table
4. Updates firm metadata (`last_payout_at`, etc.)
5. Cleans up payouts older than 24h

### `scripts/update-monthly-json.js`

Standalone Node.js script that:
1. Reads firm addresses from `data/propfirms.json`
2. Fetches current month's transactions from Arbiscan
3. Updates `data/payouts/{firmId}/{YYYY-MM}.json`
4. Only updates if there are new payouts

## Monitoring

### Check Workflow Runs

1. Go to repository → Actions
2. Click on a workflow run to see logs
3. Failed runs will show a red X

### GitHub Actions Usage

Free tier includes 2000 minutes/month for private repos.

Estimated usage:
- Real-time sync: ~96 runs/day × 1 min = ~96 min/day = ~2880 min/month
- Historical sync: 1 run/day × 2 min = ~60 min/month

**Total: ~2940 min/month** - slightly over free tier for private repos.

Options:
- Make repo public (unlimited minutes)
- Reduce frequency to every 30 min (~1500 min/month)
- Upgrade GitHub plan

### Alerts

To get notified on failures:
1. Go to Settings → Notifications
2. Enable "Actions" notifications
3. Or add Slack/Discord webhook to workflow

## Troubleshooting

### "ARBISCAN_API_KEY not found"

- Check that the secret is added correctly in GitHub
- Secret names are case-sensitive

### "Missing Supabase environment variables"

- Verify both `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Make sure you're using the service role key, not the anon key

### "API error: Max rate limit reached"

- Arbiscan free tier: 5 calls/second
- The scripts include rate limiting, but if you have many firms, increase delays

### Commits not appearing

- Check that the workflow has `contents: write` permission
- Verify the `git-check` step detected changes

## Deprecation Notes

The Vercel cron job at `/api/cron/sync-payouts` has been disabled:
- `vercel.json` now has empty `crons` array
- The endpoint still exists for manual testing
- Can be re-enabled if needed by updating `vercel.json`
