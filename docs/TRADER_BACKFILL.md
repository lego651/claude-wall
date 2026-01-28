# Trader History Backfill System

## Overview

The backfill system allows users to see their **complete transaction history** immediately after adding their wallet address. It fetches ALL historical transactions from the blockchain and generates monthly JSON files.

---

## Architecture

### Data Flow

```
User adds wallet → Profile API → Backfill API → Script → Arbiscan
                                                    ↓
                                           Generate JSON files
                                                    ↓
                                    data/traders/{wallet}/YYYY-MM.json
                                                    ↓
                                              Git commit + push
                                                    ↓
                                           Vercel auto-deploy
                                                    ↓
                                    User sees full history in dashboard
```

### Components

1. **Script**: `scripts/backfill-trader-history.js`
   - Fetches ALL transactions from Arbiscan
   - Groups by month
   - Generates JSON files for each month
   - Run time: 30 seconds - 5 minutes (depending on transaction count)

2. **API**: `/api/backfill-trader` (POST)
   - Authenticated endpoint
   - Verifies wallet belongs to user
   - Executes backfill script
   - Updates `profiles.backfilled_at` timestamp

3. **Profile API**: `/api/user/profile` (POST)
   - Detects when wallet is added/changed
   - Triggers backfill automatically
   - Returns `backfill_triggered: true`

4. **UI**: Dashboard banner
   - Shows syncing status
   - Polls API every 10 seconds
   - Auto-reloads when complete

---

## Usage

### Manual Backfill (Development)

```bash
# Backfill a specific wallet
node scripts/backfill-trader-history.js 0x1234...abcd

# Check output
ls data/traders/0x1234...abcd/
# Should see: 2024-01.json, 2024-02.json, ..., 2026-01.json
```

### Automatic Backfill (Production)

When a user adds their wallet in settings:

1. User clicks "Edit Settings"
2. Enters wallet address
3. Clicks "Save Changes"
4. Profile API detects new wallet
5. Triggers backfill API (fire-and-forget)
6. User sees alert: "Your history is being synced..."
7. Dashboard shows syncing banner
8. Backfill runs in background (1-5 minutes)
9. Dashboard auto-reloads when complete

---

## Database Schema

```sql
-- profiles table
ALTER TABLE profiles ADD COLUMN backfilled_at TIMESTAMPTZ;

-- Example
UPDATE profiles SET backfilled_at = NOW() WHERE id = 'user-123';
```

**Purpose**: Track which wallets have been backfilled to avoid re-running

---

## JSON File Structure

```json
// data/traders/0x1234.../2025-01.json
{
  "wallet_address": "0x1234...abcd",
  "year_month": "2025-01",
  "summary": {
    "totalPayouts": 45000,
    "payoutCount": 12,
    "largestPayout": 8500,
    "avgPayout": 3750
  },
  "dailyBuckets": [
    { "date": "2025-01-05", "total": 5000 },
    { "date": "2025-01-12", "total": 8500 },
    ...
  ],
  "transactions": [
    {
      "tx_hash": "0xabc...",
      "timestamp": "2025-01-05T14:30:00.000Z",
      "from_address": "0xfirm...",
      "to_address": "0x1234...",
      "token": "USDC",
      "amount": 5000,
      "block_number": 424443830
    },
    ...
  ]
}
```

---

## API Reference

### POST /api/backfill-trader

**Purpose**: Trigger backfill for authenticated user's wallet

**Auth**: Required (Supabase session)

**Request**:
```json
{
  "wallet_address": "0x1234...abcd"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Transaction history backfilled successfully",
  "wallet_address": "0x1234...abcd"
}
```

**Response (Timeout)**:
```json
{
  "error": "Backfill timeout - wallet may have too many transactions. Contact support.",
  "code": "TIMEOUT"
}
```

---

### GET /api/backfill-trader

**Purpose**: Check if user's wallet has been backfilled

**Auth**: Required

**Response**:
```json
{
  "backfilled": true,
  "has_wallet": true,
  "backfilled_at": "2026-01-28T10:30:00.000Z"
}
```

---

## Error Handling

### Timeout (>5 minutes)

If backfill takes longer than 5 minutes (extremely high transaction count):

1. API returns 504 timeout error
2. User sees message: "Contact support"
3. **Solution**: Run script manually and commit files

```bash
# Manual backfill for large wallets
node scripts/backfill-trader-history.js 0xwallet --no-timeout

# Commit results
git add data/traders/
git commit -m "Manual backfill for wallet 0xwallet"
git push
```

### Missing Transactions

If Arbiscan API fails to return some transactions:

1. Script logs warning
2. Continues with available data
3. Next sync (5 min) fills gaps
4. **Or** re-run backfill manually

---

## Performance Considerations

### Arbiscan API Limits

- **Rate Limit**: 5 calls/second (free tier)
- **Calls per backfill**: 2 calls (native + token)
- **Delays**: 300ms between calls, 500ms between retries

### Execution Time

| Transaction Count | Backfill Time |
|-------------------|---------------|
| 0 - 100 txs | 5-10 seconds |
| 100 - 500 txs | 10-30 seconds |
| 500 - 2000 txs | 30-90 seconds |
| 2000+ txs | 1-5 minutes |

### Vercel Serverless Limits

- **Max execution**: 5 minutes (Hobby), 15 minutes (Pro)
- **Recommendation**: Move to queue system (Inngest, BullMQ) for Pro accounts

---

## Testing

### 1. Test Script Directly

```bash
# Set environment variable
export ARBISCAN_API_KEY=your_key_here

# Run for a test wallet with known transactions
node scripts/backfill-trader-history.js 0x0074fa9c170e12351afabd7df0ebd0aed2a5eab3

# Expected output:
# ✅ Fetched X native transactions
# ✅ Fetched Y token transactions
# ✅ Processed Z valid incoming transactions
# ✅ Found N months with transactions
# 💾 Created: 2025-12.json (5 txs, $1,234)
# 💾 Created: 2026-01.json (2 txs, $567)
```

### 2. Test API Endpoint

```bash
# Get session token from browser DevTools
TOKEN="your_supabase_session_token"

# Trigger backfill
curl -X POST http://localhost:3000/api/backfill-trader \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-access-token=$TOKEN" \
  -d '{"wallet_address": "0x1234...abcd"}'

# Check status
curl http://localhost:3000/api/backfill-trader \
  -H "Cookie: sb-access-token=$TOKEN"
```

### 3. Test UI Flow

1. Sign in to dashboard
2. Click "Edit Settings"
3. Add wallet: `0x0074fa9c170e12351afabd7df0ebd0aed2a5eab3`
4. Save
5. Should see alert: "Your history is being synced..."
6. Dashboard shows blue syncing banner
7. Wait 1-5 minutes
8. Banner disappears
9. Full history appears in transaction table

---

## Migration Checklist

- [x] Create backfill script
- [x] Create API endpoint
- [x] Update profile API to trigger backfill
- [x] Add UI syncing banner
- [x] Add `backfilled_at` column migration
- [ ] Run database migration
- [ ] Test with real wallet
- [ ] Deploy to production
- [ ] Monitor first user backfills

---

## Future Improvements

1. **Job Queue**: Move to Inngest/BullMQ for better reliability
2. **Progress Tracking**: Show "40% complete (3/8 months processed)"
3. **Retry Logic**: Automatic retry on failure
4. **Webhook**: Notify user via email when backfill completes
5. **Batch Processing**: Backfill multiple users in parallel
6. **Caching**: Store Arbiscan responses to avoid re-fetching

---

## Troubleshooting

### Backfill not triggered

**Check**:
- Profile API logs: `[Profile API] New wallet detected`
- Backfill API logs: `[Backfill API] Starting backfill`

### JSON files not created

**Check**:
- Script permissions: `chmod +x scripts/backfill-trader-history.js`
- Data directory exists: `mkdir -p data/traders`
- Arbiscan API key set: `echo $ARBISCAN_API_KEY`

### Dashboard not updating

**Check**:
- `backfilled_at` column updated in database
- Browser console for polling logs
- Clear browser cache and reload

---

## Contact

For issues or questions:
- GitHub Issues: [github.com/lego651/claude-wall/issues](https://github.com/lego651/claude-wall/issues)
- Email: support@propproof.com
