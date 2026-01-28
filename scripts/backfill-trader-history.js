#!/usr/bin/env node

/**
 * Backfill Trader History Script
 *
 * Fetches ALL historical transactions for a trader wallet from Arbiscan
 * and generates JSON files for ALL months (not just current month).
 *
 * This script is designed to run once when a user first adds their wallet
 * to populate their complete transaction history.
 *
 * Usage:
 *   node scripts/backfill-trader-history.js <wallet_address>
 *   node scripts/backfill-trader-history.js 0x1234...abcd
 *
 * Required environment variables:
 *   - ARBISCAN_API_KEY
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const ARBISCAN_API_BASE = 'https://api.etherscan.io/v2/api';
const ARBITRUM_CHAIN_ID = '42161';
const TRADERS_DIR = path.join(process.cwd(), 'data', 'traders');

// Token config
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];
const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00, RISEPAY: 1.00 };

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Group transactions by year-month
 * @param {Array} transactions - Array of processed transactions
 * @returns {Object} Map of yearMonth -> transactions array
 */
function groupTransactionsByMonth(transactions) {
  const groups = {};

  for (const tx of transactions) {
    const date = new Date(tx.timestamp);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!groups[yearMonth]) {
      groups[yearMonth] = [];
    }
    groups[yearMonth].push(tx);
  }

  return groups;
}

/**
 * Build month data with daily buckets
 * @param {string} walletAddress - Wallet address
 * @param {string} yearMonth - Year-month in YYYY-MM format
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} Month data object
 */
function buildMonthData(walletAddress, yearMonth, transactions) {
  // Calculate summary
  const amounts = transactions.map(t => t.amount);
  const summary = {
    totalPayouts: Math.round(amounts.reduce((a, b) => a + b, 0)),
    payoutCount: transactions.length,
    largestPayout: Math.round(amounts.length > 0 ? Math.max(...amounts) : 0),
    avgPayout: Math.round(amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0),
  };

  // Build daily buckets (using UTC)
  const dailyMap = {};
  for (const t of transactions) {
    const day = t.timestamp.split('T')[0]; // YYYY-MM-DD
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, total: 0 };
    }
    dailyMap[day].total += t.amount;
  }

  // Convert to array and round
  const dailyBuckets = Object.values(dailyMap)
    .map(b => ({ ...b, total: Math.round(b.total) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    wallet_address: walletAddress.toLowerCase(),
    year_month: yearMonth,
    summary,
    dailyBuckets,
    transactions: transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
  };
}

// ============================================================================
// Arbiscan API
// ============================================================================

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '0' && data.message !== 'No transactions found') {
        throw new Error(`API error: ${data.message}`);
      }

      return data.result || [];
    } catch (err) {
      console.log(`  Retry ${i + 1}/${retries}: ${err.message}`);
      if (i === retries - 1) throw err;
      await sleep(2000);
    }
  }
}

async function fetchAllTransactions(address, apiKey) {
  console.log(`  Fetching native transactions...`);
  const nativeUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;
  const native = await fetchWithRetry(nativeUrl);

  await sleep(300); // Rate limit

  console.log(`  Fetching token transactions...`);
  const tokenUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;
  const tokens = await fetchWithRetry(tokenUrl);

  return { native, tokens };
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Process ALL transactions for a trader wallet (incoming transactions)
 * @param {Array} native - Native ETH transactions
 * @param {Array} tokens - Token transactions
 * @param {string} walletAddress - Trader wallet address
 * @returns {Array} Processed transactions with ISO timestamps
 */
function processAllTransactions(native, tokens, walletAddress) {
  const walletLower = walletAddress.toLowerCase();
  const transactions = [];

  // Process native ETH (incoming to trader)
  for (const tx of native) {
    if (!tx.to || tx.to.toLowerCase() !== walletLower) continue;

    const timestamp = parseInt(tx.timeStamp);
    const amount = parseFloat(tx.value) / 1e18;
    const amountUSD = amount * PRICES.ETH;
    if (amountUSD < 10) continue; // Skip spam

    transactions.push({
      tx_hash: tx.hash,
      timestamp: new Date(timestamp * 1000).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
      token: 'ETH',
      amount: Math.round(amountUSD * 100) / 100,
      block_number: parseInt(tx.blockNumber),
    });
  }

  // Process tokens (incoming to trader)
  for (const tx of tokens) {
    if (!tx.to || tx.to.toLowerCase() !== walletLower) continue;

    if (!SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase())) continue;

    const timestamp = parseInt(tx.timeStamp);
    const decimals = parseInt(tx.tokenDecimal) || 18;
    const amount = parseFloat(tx.value) / Math.pow(10, decimals);
    const token = tx.tokenSymbol.toUpperCase();
    const amountUSD = amount * (PRICES[token] || 1);
    if (amountUSD < 10) continue; // Skip spam

    transactions.push({
      tx_hash: tx.hash,
      timestamp: new Date(timestamp * 1000).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
      token: token,
      amount: Math.round(amountUSD * 100) / 100,
      block_number: parseInt(tx.blockNumber),
    });
  }

  // Deduplicate and sort by timestamp (newest first)
  const unique = Array.from(new Map(transactions.map(t => [t.tx_hash, t])).values());
  return unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = Date.now();

  console.log('🚀 Trader History Backfill Script');
  console.log('==================================\n');

  // Get wallet address from command line argument
  const walletAddress = process.argv[2];

  if (!walletAddress) {
    console.error('❌ Usage: node scripts/backfill-trader-history.js <wallet_address>');
    console.error('   Example: node scripts/backfill-trader-history.js 0x1234...abcd');
    process.exit(1);
  }

  // Validate wallet address format
  if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.error('❌ Invalid Ethereum address format');
    process.exit(1);
  }

  console.log(`Wallet: ${walletAddress}\n`);

  // Validate environment
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error('❌ ARBISCAN_API_KEY not found');
    process.exit(1);
  }

  const walletLower = walletAddress.toLowerCase();
  const walletDir = path.join(TRADERS_DIR, walletLower);

  try {
    // Step 1: Fetch ALL transactions from Arbiscan
    console.log('📊 Step 1: Fetching ALL transactions from Arbiscan...\n');
    const { native, tokens } = await fetchAllTransactions(walletAddress, apiKey);

    console.log(`  ✅ Fetched ${native.length} native transactions`);
    console.log(`  ✅ Fetched ${tokens.length} token transactions\n`);

    // Step 2: Process transactions
    console.log('🔄 Step 2: Processing transactions...\n');
    const allTransactions = processAllTransactions(native, tokens, walletAddress);

    if (allTransactions.length === 0) {
      console.log('  ⚠️  No valid transactions found (all were filtered as spam or outgoing)');
      console.log('\n✅ Backfill complete (no data to save)');
      process.exit(0);
    }

    console.log(`  ✅ Processed ${allTransactions.length} valid incoming transactions\n`);

    // Step 3: Group by month
    console.log('📅 Step 3: Grouping transactions by month...\n');
    const monthlyGroups = groupTransactionsByMonth(allTransactions);
    const months = Object.keys(monthlyGroups).sort();

    console.log(`  ✅ Found ${months.length} months with transactions:`);
    for (const month of months) {
      console.log(`     - ${month}: ${monthlyGroups[month].length} transactions`);
    }
    console.log('');

    // Step 4: Ensure wallet directory exists
    if (!fs.existsSync(walletDir)) {
      fs.mkdirSync(walletDir, { recursive: true });
      console.log(`  ✅ Created directory: ${walletDir}\n`);
    }

    // Step 5: Generate JSON files for each month
    console.log('💾 Step 4: Generating JSON files...\n');
    let filesCreated = 0;
    let filesUpdated = 0;

    for (const yearMonth of months) {
      const transactions = monthlyGroups[yearMonth];
      const monthData = buildMonthData(walletLower, yearMonth, transactions);

      const filePath = path.join(walletDir, `${yearMonth}.json`);
      const fileExists = fs.existsSync(filePath);

      fs.writeFileSync(filePath, JSON.stringify(monthData, null, 2));

      if (fileExists) {
        console.log(`  🔄 Updated: ${yearMonth}.json (${transactions.length} txs, $${monthData.summary.totalPayouts.toLocaleString()})`);
        filesUpdated++;
      } else {
        console.log(`  ✅ Created: ${yearMonth}.json (${transactions.length} txs, $${monthData.summary.totalPayouts.toLocaleString()})`);
        filesCreated++;
      }
    }

    // Step 6: Summary
    const totalAmount = allTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const duration = Date.now() - startTime;

    console.log('\n================================');
    console.log('📋 Backfill Summary\n');
    console.log(`  Wallet: ${walletAddress}`);
    console.log(`  Total transactions: ${allTransactions.length.toLocaleString()}`);
    console.log(`  Total amount: $${Math.round(totalAmount).toLocaleString()}`);
    console.log(`  Months covered: ${months[0]} to ${months[months.length - 1]}`);
    console.log(`  Files created: ${filesCreated}`);
    console.log(`  Files updated: ${filesUpdated}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    console.log('\n✅ Backfill complete!');
    console.log('\nNext steps:');
    console.log('  1. Commit changes: git add data/traders/');
    console.log('  2. Push to repo: git commit -m "Backfill history for wallet" && git push');
    console.log('  3. Vercel will auto-deploy and user will see full history');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
