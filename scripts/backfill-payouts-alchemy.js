#!/usr/bin/env node
/**
 * Backfill Prop Firm Payouts using Alchemy API
 *
 * Usage:
 *   npx tsx scripts/backfill-payouts-alchemy.js [--firm firmId] [--month YYYY-MM] [--dry-run]
 *
 * API key: set ALCHEMY_API_KEY in .env (no need to pass it on the command line).
 *
 * Uses Alchemy's getAssetTransfers API to fetch ALL historical transactions
 * (no 10k limit like Arbiscan) and generates monthly JSON files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { fetchAllAssetTransfers, alchemyTransferToPayout } from '@/lib/alchemy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
config();

// Token to payment method mapping (same as payoutSyncService)
const TOKEN_TO_METHOD = {
  'RISEPAY': 'rise',
  'USDC': 'crypto',
  'USDT': 'crypto',
  'ETH': 'crypto',
};

// Supported tokens
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];

// Token prices (TODO: fetch from API)
const PRICES = {
  ETH: 2500,
  USDC: 1.00,
  USDT: 1.00,
  RISEPAY: 1.00,
};

/**
 * Convert Alchemy transfer to payout (with proper token mapping)
 */
function convertTransferToPayout(transfer, firmId, firmAddresses) {
  const lowerAddresses = firmAddresses.map(a => a.toLowerCase());

  // Only process outgoing transfers (from the firm)
  if (!transfer.from || !lowerAddresses.includes(transfer.from.toLowerCase())) {
    return null;
  }

  const timestamp = transfer.metadata?.blockTimestamp
    ? new Date(transfer.metadata.blockTimestamp).toISOString()
    : null;

  if (!timestamp) return null; // Skip if no timestamp

  const txHash = transfer.hash;
  const fromAddress = transfer.from;
  const toAddress = transfer.to;

  let amount = 0;
  let paymentMethod = 'crypto';

  // Determine amount and payment method based on transfer category
  if (transfer.category === 'external') {
    // Native ETH transfer
    amount = parseFloat(transfer.value || 0) * PRICES.ETH;
    paymentMethod = 'crypto';
  } else if (transfer.category === 'erc20') {
    // Token transfer
    const tokenSymbol = transfer.asset?.toUpperCase();
    const value = parseFloat(transfer.value || 0);

    if (!SUPPORTED_TOKENS.includes(tokenSymbol)) {
      return null; // Skip unsupported tokens
    }

    // Map token to payment method and USD value
    if (tokenSymbol === 'RISEPAY') {
      amount = value * PRICES.RISEPAY;
      paymentMethod = 'rise';
    } else if (tokenSymbol === 'USDC' || tokenSymbol === 'USDT') {
      amount = value * PRICES[tokenSymbol];
      paymentMethod = 'crypto';
    }
  } else {
    // Skip other categories (erc721, erc1155, etc.)
    return null;
  }

  // Filter out small amounts (< $10)
  if (amount < 10) return null;

  return {
    tx_hash: txHash,
    firm_id: firmId,
    amount,
    payment_method: paymentMethod,
    timestamp,
    from_address: fromAddress,
    to_address: toAddress,
  };
}

/**
 * Process transfers for a specific month
 */
function processPayoutsForMonth(transfers, firmId, firmAddresses, yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);

  // Get month start/end in UTC
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const monthStartTs = monthStart.getTime();
  const monthEndTs = monthEnd.getTime();

  console.log(`Processing ${yearMonth}: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);

  const payouts = [];

  for (const transfer of transfers) {
    const payout = convertTransferToPayout(transfer, firmId, firmAddresses);
    if (!payout) continue;

    // Filter by month
    const ts = new Date(payout.timestamp).getTime();
    if (ts >= monthStartTs && ts < monthEndTs) {
      payouts.push(payout);
    }
  }

  // Deduplicate by tx_hash
  const uniquePayouts = Array.from(
    new Map(payouts.map(p => [p.tx_hash, p])).values()
  );

  return uniquePayouts;
}

/**
 * Build monthly JSON from payouts
 */
function buildMonthlyJSON(firmId, yearMonth, timezone, payouts) {
  // Sort by timestamp
  const sorted = payouts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Build daily buckets
  const dailyMap = new Map();

  sorted.forEach(p => {
    const date = p.timestamp.split('T')[0]; // YYYY-MM-DD
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, total: 0, rise: 0, crypto: 0, wire: 0 });
    }
    const bucket = dailyMap.get(date);
    bucket.total += p.amount;
    bucket[p.payment_method] = (bucket[p.payment_method] || 0) + p.amount;
  });

  const dailyBuckets = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Calculate summary
  const summary = {
    totalPayouts: Math.round(sorted.reduce((sum, p) => sum + p.amount, 0)),
    payoutCount: sorted.length,
    largestPayout: sorted.length > 0 ? Math.round(Math.max(...sorted.map(p => p.amount))) : 0,
    avgPayout: 0,
  };
  summary.avgPayout = summary.payoutCount > 0
    ? Math.round(summary.totalPayouts / summary.payoutCount)
    : 0;

  return {
    firmId,
    period: yearMonth,
    timezone,
    generatedAt: new Date().toISOString(),
    summary,
    dailyBuckets,
    transactions: sorted,
  };
}

/**
 * Get missing months for a firm (from 2025-01 to oldest existing month)
 */
function getMissingMonths(firmId, dataDir) {
  const firmDir = path.join(dataDir, firmId);

  if (!fs.existsSync(firmDir)) {
    console.log(`No data directory for ${firmId}, will create and backfill from 2025-01`);
    return getAllMonthsFrom2025();
  }

  const files = fs.readdirSync(firmDir)
    .filter(f => f.endsWith('.json') && /^\d{4}-\d{2}\.json$/.test(f))
    .map(f => f.replace('.json', ''))
    .sort();

  if (files.length === 0) {
    return getAllMonthsFrom2025();
  }

  const oldestMonth = files[0];
  console.log(`Oldest existing month for ${firmId}: ${oldestMonth}`);

  // Generate list of missing months from 2025-01 to oldestMonth (exclusive)
  const missing = [];
  const [oldestYear, oldestMonthNum] = oldestMonth.split('-').map(Number);
  let year = 2025;
  let month = 1;

  while (year < oldestYear || (year === oldestYear && month < oldestMonthNum)) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    if (!files.includes(yearMonth)) {
      missing.push(yearMonth);
    }
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return missing;
}

/**
 * Get all months from 2025-01 to current month
 */
function getAllMonthsFrom2025() {
  const months = [];
  const now = new Date();
  let year = 2025;
  let month = 1;

  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

/**
 * Backfill a single month for a firm using Alchemy
 */
async function backfillMonth(firm, yearMonth, apiKey, dataDir, dryRun) {
  console.log(`\n=== Backfilling ${firm.id} / ${yearMonth} ===`);

  const outputPath = path.join(dataDir, firm.id, `${yearMonth}.json`);

  // Check if file already exists
  if (fs.existsSync(outputPath)) {
    console.log(`File already exists: ${outputPath} (skipping)`);
    return { skipped: true };
  }

  // Calculate timestamp range for the month
  const [year, month] = yearMonth.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const cutoffTimestamp = Math.floor(monthStart.getTime() / 1000);

  console.log(`Month: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);
  console.log(`Fetching ALL transfers for ${firm.addresses.length} address(es)...`);

  // Fetch all transfers for all addresses (no block range - fetch everything!)
  let allTransfers = [];

  for (const address of firm.addresses) {
    console.log(`  Fetching ${address}...`);

    const transfers = await fetchAllAssetTransfers(address, apiKey, {
      fromBlock: '0x0', // Start from beginning
      toBlock: 'latest', // To current block
      category: ['external', 'erc20'], // Only ETH and ERC20 tokens
      cutoffTimestamp, // Stop when we hit transfers older than month start
      delayMs: 500,
    });

    allTransfers = [...allTransfers, ...transfers];
    console.log(`    Fetched: ${transfers.length} transfers`);

    // Rate limit between addresses
    if (firm.addresses.length > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`Total fetched: ${allTransfers.length} transfers`);

  // Process payouts for this month only
  const payouts = processPayoutsForMonth(allTransfers, firm.id, firm.addresses, yearMonth);

  console.log(`Processed ${payouts.length} payouts for ${yearMonth}`);

  if (payouts.length === 0) {
    console.log(`No payouts found for ${yearMonth}, skipping file creation`);
    return { skipped: true, reason: 'no_payouts' };
  }

  // Build monthly JSON
  const monthlyData = buildMonthlyJSON(firm.id, yearMonth, firm.timezone || 'UTC', payouts);

  // Write to file
  if (dryRun) {
    console.log(`[DRY RUN] Would write to: ${outputPath}`);
    console.log(`[DRY RUN] Summary:`, monthlyData.summary);
    return { created: true, dryRun: true, summary: monthlyData.summary };
  }

  // Create directory if needed
  const firmDir = path.join(dataDir, firm.id);
  if (!fs.existsSync(firmDir)) {
    fs.mkdirSync(firmDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(monthlyData, null, 2));
  console.log(`✓ Wrote ${outputPath}`);
  console.log(`  Summary:`, monthlyData.summary);

  return { created: true, summary: monthlyData.summary };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const firmFilter = args.includes('--firm') ? args[args.indexOf('--firm') + 1] : null;
  const monthFilter = args.includes('--month') ? args[args.indexOf('--month') + 1] : null;
  const dryRun = args.includes('--dry-run');

  console.log('=== Backfill Prop Firm Payouts using Alchemy API ===\n');

  if (dryRun) {
    console.log('[DRY RUN MODE - No files will be written]\n');
  }

  // Check API key
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ALCHEMY_API_KEY environment variable is required');
    process.exit(1);
  }

  // Load firms
  const firmsPath = path.join(__dirname, '..', 'data', 'propfirms.json');
  const firmsData = JSON.parse(fs.readFileSync(firmsPath, 'utf8'));
  let firms = firmsData.firms;

  if (firmFilter) {
    firms = firms.filter(f => f.id === firmFilter);
    if (firms.length === 0) {
      console.error(`ERROR: Firm not found: ${firmFilter}`);
      process.exit(1);
    }
    console.log(`Filtering to firm: ${firmFilter}\n`);
  }

  const dataDir = path.join(__dirname, '..', 'data', 'propfirms');

  // Process each firm
  for (const firm of firms) {
    console.log(`\n--- Firm: ${firm.name} (${firm.id}) ---`);

    // Get missing months
    let months;
    if (monthFilter) {
      months = [monthFilter];
      console.log(`Filtering to month: ${monthFilter}`);
    } else {
      months = getMissingMonths(firm.id, dataDir);
      console.log(`Missing months: ${months.length > 0 ? months.join(', ') : 'none'}`);
    }

    if (months.length === 0 && !monthFilter) {
      console.log('No missing months, skipping');
      continue;
    }

    // Backfill each month
    for (const month of months) {
      try {
        await backfillMonth(firm, month, apiKey, dataDir, dryRun);
      } catch (err) {
        console.error(`ERROR backfilling ${firm.id}/${month}:`, err.message);
        console.error(err.stack);
        // Continue with next month
      }
    }
  }

  console.log('\n=== Backfill Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
