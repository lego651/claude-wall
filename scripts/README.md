# Payout Backfill Scripts

This folder contains scripts for fetching and backfilling prop firm payout data from Arbitrum blockchain.

## Scripts Overview

### 1. `update-monthly-json.js` (Arbiscan - Daily Updates)

**Purpose**: Update the current month's data daily (automated via GitHub Actions)

**API**: Arbiscan (latest 10k transactions - sufficient for current month)

**When to use**:
- Automated daily sync via `.github/workflows/sync-firm-payouts-historical.yml`
- Manual updates for current month only

**Usage**:
```bash
npx tsx scripts/update-monthly-json.js
npx tsx scripts/update-monthly-json.js --firm fundingpips
```
API key: set `ARBISCAN_API_KEY` in `.env`.

**What it does**:
- Fetches latest 10,000 transactions (covers recent activity)
- Updates current month JSON file for ALL firms
- Fast and within Arbiscan's free tier limits

---

### 2. `backfill-payouts-alchemy.js` (Alchemy - Historical Backfill)

**Purpose**: Backfill OLD historical data (beyond Arbiscan's 10k limit)

**API**: Alchemy (unlimited historical data via pagination)

**When to use**:
- Backfilling months from 2025-01 onwards
- Any firm that has >10k total transactions
- One-time or infrequent historical data fills

**Usage**:
```bash
# Dry run for single firm/month
npx tsx scripts/backfill-payouts-alchemy.js --firm fundednext --month 2025-01 --dry-run

# Backfill single month
npx tsx scripts/backfill-payouts-alchemy.js --firm fundednext --month 2025-01

# Backfill all missing months for a firm
npx tsx scripts/backfill-payouts-alchemy.js --firm fundingpips

# Backfill all missing months for all firms
npx tsx scripts/backfill-payouts-alchemy.js
```
API key: set `ALCHEMY_API_KEY` in `.env`.

**What it does**:
- Fetches ALL historical transactions (no 10k limit!)
- Generates monthly JSON files for missing months
- Automatically detects missing months from 2025-01
- Skips months that already have files

---

### 3. `backfill-payouts-arbiscan.js` (Arbiscan - Legacy)

**Purpose**: Legacy backfill script (DO NOT USE - limited by 10k)

**API**: Arbiscan with pagination (but still capped at 10k total)

**When to use**:
- ❌ **Don't use this** - Use Alchemy instead for historical data
- Kept for reference only

**Limitation**:
- Even with pagination, Arbiscan only returns the latest 10,000 transactions
- Cannot fetch data older than the most recent 10k transactions

---

## Which Script Should I Use?

### For Current Month Updates (Automated)
✅ **Use**: `update-monthly-json.js` (Arbiscan)
- Runs daily via GitHub Actions
- Fast and efficient for recent data
- No setup needed (already configured)

### For Historical Backfill (Manual)
✅ **Use**: `backfill-payouts-alchemy.js` (Alchemy)
- One-time backfill from 2025-01 onwards
- Fetches complete historical data
- Breaks through 10k transaction limit

### For Firms That Need Historical Data

| Firm | Oldest Existing | Missing Months | Action |
|------|----------------|----------------|--------|
| fundingpips | 2025-08 | 2025-01 to 2025-07 | Use Alchemy backfill |
| the5ers | 2025-07 | 2025-01 to 2025-06 | Use Alchemy backfill |
| alphacapitalgroup | 2025-04 | 2025-01 to 2025-03 | Use Alchemy backfill |
| fundednext | 2025-12 | 2025-01 to 2025-11 | Use Alchemy backfill |
| Others | 2025-01/02 | None | No action needed |

---

## Running scripts (unified style)

All scripts are run with **`npx tsx scripts/<script>.js`**.  
**All API keys are read from `.env`** — do not pass them on the command line (e.g. no `ARBISCAN_API_KEY=xxx node ...`).

```bash
# Current month update (all firms or one firm)
npx tsx scripts/update-monthly-json.js
npx tsx scripts/update-monthly-json.js --firm fundingpips

# Historical backfill (Alchemy)
npx tsx scripts/backfill-payouts-alchemy.js --firm fundingpips
npx tsx scripts/backfill-payouts-alchemy.js --firm fundednext --month 2025-01
npx tsx scripts/backfill-payouts-alchemy.js   # all firms, all missing months
```

---

## Setup Requirements

Put API keys in `.env` at the project root. Scripts load them automatically.

### Arbiscan API Key
1. Get free key: https://arbiscan.io/apis
2. Add to `.env`: `ARBISCAN_API_KEY=your_key_here`
3. Limit: 100k calls/day (sufficient for daily updates)

### Alchemy API Key
1. Sign up: https://www.alchemy.com/
2. Create app for **Arbitrum One**
3. Add to `.env`: `ALCHEMY_API_KEY=your_key_here`
4. Free tier: 300M CU/month (~2.5M requests)

---

## Validation

The Alchemy implementation has been validated against Arbiscan data:

**Test Case**: fundingpips 2026-01

| Metric | Arbiscan | Alchemy | Match |
|--------|----------|---------|-------|
| Total Payouts | $3,677,002 | $3,677,002 | ✅ |
| Payout Count | 1,890 | 1,890 | ✅ |
| Largest Payout | $30,075 | $30,075 | ✅ |
| Average Payout | $1,946 | $1,946 | ✅ |

Both APIs produce identical results. Alchemy is preferred for historical data because it has no transaction limits.

---

## File Output Format

All scripts generate the same JSON format:

```json
{
  "firmId": "fundingpips",
  "period": "2026-01",
  "timezone": "UTC",
  "generatedAt": "2026-01-31T12:00:00.000Z",
  "summary": {
    "totalPayouts": 3677002,
    "payoutCount": 1890,
    "largestPayout": 30075,
    "avgPayout": 1946
  },
  "dailyBuckets": [
    {
      "date": "2026-01-02",
      "total": 111599,
      "rise": 111599,
      "crypto": 0,
      "wire": 0
    }
  ],
  "transactions": [
    {
      "tx_hash": "0x...",
      "firm_id": "fundingpips",
      "amount": 1500,
      "payment_method": "rise",
      "timestamp": "2026-01-02T10:30:00.000Z",
      "from_address": "0x...",
      "to_address": "0x..."
    }
  ]
}
```

---

## Troubleshooting

### "ARBISCAN_API_KEY environment variable is required"
- Make sure `.env` file exists with `ARBISCAN_API_KEY=...`
- For GitHub Actions, add secret in repo settings

### "ALCHEMY_API_KEY environment variable is required"
- Make sure `.env` file exists with `ALCHEMY_API_KEY=...`
- Sign up for free Alchemy account

### "No payouts found for YYYY-MM"
- The firm may not have had any payouts that month
- Check if the firm existed during that period
- Verify the firm's address is correct in `data/propfirms.json`

### Alchemy requests timing out
- Increase the `delayMs` parameter in the script (default: 500ms)
- Check your Alchemy plan's rate limits
