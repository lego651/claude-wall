#!/usr/bin/env node
/**
 * Backfill Prop Firm Payouts to January 2025
 *
 * Usage:
 *   ARBISCAN_API_KEY=xxx npx tsx scripts/backfill-firm-payouts-to-jan2025.js [--firm firmId] [--month YYYY-MM] [--dry-run]
 *
 * Fetches ALL historical transactions via paginated Arbiscan API and generates
 * monthly JSON files for missing months from 2025-01 onwards.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { fetchAllNativeTransactions, fetchAllTokenTransactions } from '@/lib/arbiscan';

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
 * Process raw Arbiscan data into payout records for a specific month
 */
function processPayoutsForMonth(nativeData, tokenData, sourceAddresses, firmId, yearMonth, timezone) {
  const lowerAddresses = sourceAddresses.map(a => a.toLowerCase());
  const [year, month] = yearMonth.split('-').map(Number);

  // Get month start/end in UTC (firms use UTC timezone)
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));
  const monthStartTs = monthStart.getTime() / 1000;
  const monthEndTs = monthEnd.getTime() / 1000;

  console.log(`Processing ${yearMonth}: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`);

  // Process native ETH (outgoing from firm)
  const nativePayouts = nativeData
    .filter(tx => tx.from && lowerAddresses.includes(tx.from.toLowerCase()))
    .filter(tx => {
      const ts = parseInt(tx.timeStamp);
      return ts >= monthStartTs && ts < monthEndTs;
    })
    .map(tx => {
      const amount = parseFloat(tx.value) / 1e18;
      const amountUSD = amount * PRICES.ETH;
      return {
        tx_hash: tx.hash,
        firm_id: firmId,
        amount: amountUSD,
        payment_method: 'crypto',
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
      };
    });

  // Process ERC-20 tokens (outgoing from firm)
  const tokenPayouts = tokenData
    .filter(tx => tx.from && lowerAddresses.includes(tx.from.toLowerCase()))
    .filter(tx => {
      const ts = parseInt(tx.timeStamp);
      return ts >= monthStartTs && ts < monthEndTs;
    })
    .filter(tx => SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase()))
    .map(tx => {
      const decimals = parseInt(tx.tokenDecimal) || 18;
      const amount = parseFloat(tx.value) / Math.pow(10, decimals);
      const token = tx.tokenSymbol.toUpperCase();
      const amountUSD = amount * (PRICES[token] || 1);
      return {
        tx_hash: tx.hash,
        firm_id: firmId,
        amount: amountUSD,
        payment_method: TOKEN_TO_METHOD[token] || 'crypto',
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
      };
    });

  // Combine, filter spam (<$10), and deduplicate
  const allPayouts = [...nativePayouts, ...tokenPayouts]
    .filter(p => p.amount >= 10);

  // Deduplicate by tx_hash
  const uniquePayouts = Array.from(
    new Map(allPayouts.map(p => [p.tx_hash, p])).values()
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
 * Backfill a single month for a firm
 */
async function backfillMonth(firm, yearMonth, apiKey, dataDir, dryRun) {
  console.log(`\n=== Backfilling ${firm.id} / ${yearMonth} ===`);

  const outputPath = path.join(dataDir, firm.id, `${yearMonth}.json`);

  // Check if file already exists
  if (fs.existsSync(outputPath)) {
    console.log(`File already exists: ${outputPath} (skipping)`);
    return { skipped: true };
  }

  // Calculate cutoff: start of the month BEFORE this one (to fetch all data for this month)
  const [year, month] = yearMonth.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const cutoffDate = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

  console.log(`Cutoff timestamp: ${cutoffDate.toISOString()} (${cutoffTimestamp})`);
  console.log(`Fetching ALL transactions for ${firm.addresses.length} address(es)...`);

  // Fetch all transactions for all addresses
  let allNative = [];
  let allTokens = [];

  for (const address of firm.addresses) {
    console.log(`  Fetching ${address}...`);

    const [native, tokens] = await Promise.all([
      fetchAllNativeTransactions(address, apiKey, { cutoffTimestamp, delayMs: 500 }),
      fetchAllTokenTransactions(address, apiKey, { cutoffTimestamp, delayMs: 500 }),
    ]);

    allNative = [...allNative, ...native];
    allTokens = [...allTokens, ...tokens];

    console.log(`    Native: ${native.length}, Token: ${tokens.length}`);

    // Rate limit between addresses
    if (firm.addresses.length > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`Total fetched - Native: ${allNative.length}, Token: ${allTokens.length}`);

  // Process payouts for this month only
  const payouts = processPayoutsForMonth(
    allNative,
    allTokens,
    firm.addresses,
    firm.id,
    yearMonth,
    firm.timezone || 'UTC'
  );

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

  console.log('=== Backfill Prop Firm Payouts to January 2025 ===\n');

  if (dryRun) {
    console.log('[DRY RUN MODE - No files will be written]\n');
  }

  // Check API key
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error('ERROR: ARBISCAN_API_KEY environment variable is required');
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
