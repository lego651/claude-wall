# Alchemy API Integration for Historical Payout Backfill

## Problem

Arbiscan API only returns the **latest 10,000 transactions** per address, making it impossible to fetch complete historical data for high-volume firms. Even with pagination, we can only paginate within those 10,000 records.

## Solution: Alchemy's `getAssetTransfers` API

Alchemy provides unlimited historical transaction data via their `getAssetTransfers` endpoint with proper pagination support.

### Key Advantages

- ✅ **No 10,000 limit** - fetch ALL historical transactions
- ✅ **Built-in pagination** with `pageKey`
- ✅ **Single API call** returns both native + token transfers
- ✅ **Generous free tier**: 300M compute units/month (≈2.5M requests)
- ✅ **120 CU per request** vs Arbiscan's 100k daily limit
- ✅ **Supports Arbitrum** natively

### Cost Estimate

- **Free Tier**: 300M CU/month
- **Per Request**: 120 CU
- **Backfill Cost**: ~400 requests × 120 CU = 48,000 CU (< 0.02% of free tier)

## Implementation

### 1. New Files Created

- **`lib/alchemy.js`**: Alchemy client with pagination support
  - `fetchAssetTransfers()`: Single page fetch
  - `fetchAllAssetTransfers()`: Auto-paginating fetch for ALL transfers
  - `alchemyTransferToPayout()`: Convert Alchemy format to our payout format

- **`scripts/backfill-payouts-alchemy.js`**: Backfill script using Alchemy
  - Fetches complete historical data (no 10k limit)
  - Same CLI interface as Arbiscan version
  - Supports `--firm`, `--month`, `--dry-run`

### 2. Setup Instructions

#### Get Alchemy API Key

1. Sign up at https://www.alchemy.com/
2. Create a new app for **Arbitrum One**
3. Copy the API key

#### Add to .env

```bash
ALCHEMY_API_KEY=your_api_key_here
```

### 3. Usage

#### Test with Single Firm/Month (Dry Run)

```bash
npx tsx scripts/backfill-payouts-alchemy.js --firm fundednext --month 2025-01 --dry-run
```

#### Backfill Single Month

```bash
npx tsx scripts/backfill-payouts-alchemy.js --firm fundednext --month 2025-01
```

#### Backfill All Missing Months for All Firms

```bash
npx tsx scripts/backfill-payouts-alchemy.js
```

#### Commit and Push

```bash
git add data/propfirms/
git commit -m "chore: backfill firm payout data to Jan 2025"
git push
```

## API Details

### Endpoint

```
POST https://arb-mainnet.g.alchemy.com/v2/{apiKey}
```

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "alchemy_getAssetTransfers",
  "params": [{
    "fromAddress": "0x...",
    "fromBlock": "0x0",
    "toBlock": "latest",
    "category": ["external", "erc20"],
    "order": "desc",
    "maxCount": "0x3e8",
    "pageKey": "..."
  }]
}
```

### Response Format

```json
{
  "result": {
    "transfers": [
      {
        "blockNum": "0x...",
        "hash": "0x...",
        "from": "0x...",
        "to": "0x...",
        "value": 1234.56,
        "asset": "USDC",
        "category": "erc20",
        "metadata": {
          "blockTimestamp": "2025-01-15T12:34:56.000Z"
        }
      }
    ],
    "pageKey": "..."
  }
}
```

## Comparison: Arbiscan vs Alchemy

| Feature | Arbiscan | Alchemy |
|---------|----------|---------|
| **Transaction Limit** | 10,000 max | Unlimited |
| **Pagination** | Within 10k only | True pagination with `pageKey` |
| **API Calls** | 2 calls (native + token) | 1 call (combined) |
| **Free Tier** | 100k calls/day | 300M CU/month (≈2.5M calls) |
| **Rate Limit** | 5 calls/sec | 330 CUPs/sec |
| **Historical Data** | ❌ Limited | ✅ Complete |

## Next Steps

1. ✅ Create Alchemy account and get API key
2. ✅ Add `ALCHEMY_API_KEY` to `.env`
3. ✅ Test with fundednext Jan 2025: `npx tsx scripts/backfill-payouts-alchemy.js --firm fundednext --month 2025-01 --dry-run`
4. ✅ Verify output matches expected format
5. ✅ Run full backfill for all firms
6. ✅ Commit and push data

## Future Considerations

- **Arbiscan Deprecation**: Consider deprecating `lib/arbiscan.js` pagination functions since Alchemy is superior
- **Real-time Sync**: Update `lib/inngest-payouts.ts` to use Alchemy instead of Arbiscan
- **Cost Monitoring**: Track CU usage via Alchemy dashboard
- **Block Timestamp**: Alchemy provides `metadata.blockTimestamp` directly (no estimation needed)

## References

- [Alchemy getAssetTransfers Docs](https://www.alchemy.com/docs/reference/alchemy-getassettransfers)
- [Alchemy Pricing](https://www.alchemy.com/pricing)
- [Compute Unit Costs](https://www.alchemy.com/docs/reference/compute-unit-costs)
