#!/usr/bin/env node

/**
 * Update Trader Monthly Payout History (Supabase)
 *
 * Fetches current month's transaction data from Arbiscan for all trader wallets
 * and upserts into Supabase trader_payout_history. Designed to run daily via GitHub Actions.
 * New users see data immediately (no git push delay).
 *
 * Usage:
 *   node scripts/update-trader-monthly-json.js
 *
 * Required environment variables:
 *   - ARBISCAN_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const ARBISCAN_API_BASE = 'https://api.etherscan.io/v2/api';
const ARBITRUM_CHAIN_ID = '42161';
const HISTORY_TABLE = 'trader_payout_history';

// Token config
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];
const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00, RISEPAY: 1.00 };

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthStartTimestamp(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1, 0, 0, 0, 0).getTime() / 1000;
}

function getMonthEndTimestamp(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0, 23, 59, 59, 999).getTime() / 1000;
}

// ============================================================================
// Supabase Client
// ============================================================================

async function createSupabaseClient() {
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
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
  console.log(`  Fetching native transactions for ${address.slice(0, 10)}...`);
  const nativeUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;
  const native = await fetchWithRetry(nativeUrl);
  
  await sleep(300); // Rate limit
  
  console.log(`  Fetching token transactions for ${address.slice(0, 10)}...`);
  const tokenUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;
  const tokens = await fetchWithRetry(tokenUrl);
  
  return { native, tokens };
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Process transactions for a trader wallet (incoming transactions)
 * @param {Array} native - Native ETH transactions
 * @param {Array} tokens - Token transactions
 * @param {string} walletAddress - Trader wallet address
 * @param {string} yearMonth - Target month in YYYY-MM format
 * @returns {Array} Filtered and processed transactions
 */
function processTransactionsForMonth(native, tokens, walletAddress, yearMonth) {
  const walletLower = walletAddress.toLowerCase();
  const monthStart = getMonthStartTimestamp(yearMonth);
  const monthEnd = getMonthEndTimestamp(yearMonth);
  const transactions = [];

  // Process native ETH (incoming to trader)
  for (const tx of native) {
    if (!tx.to || tx.to.toLowerCase() !== walletLower) continue;
    
    const timestamp = parseInt(tx.timeStamp);
    if (timestamp < monthStart || timestamp > monthEnd) continue;
    
    const amount = parseFloat(tx.value) / 1e18;
    const amountUSD = amount * PRICES.ETH;
    if (amountUSD < 10) continue; // Skip spam
    
    transactions.push({
      tx_hash: tx.hash,
      timestamp: new Date(timestamp * 1000).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
      token: 'ETH',
      amount: amountUSD,
      block_number: parseInt(tx.blockNumber),
    });
  }

  // Process tokens (incoming to trader)
  for (const tx of tokens) {
    if (!tx.to || tx.to.toLowerCase() !== walletLower) continue;
    
    const timestamp = parseInt(tx.timeStamp);
    if (timestamp < monthStart || timestamp > monthEnd) continue;
    
    if (!SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase())) continue;
    
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
      amount: amountUSD,
      block_number: parseInt(tx.blockNumber),
    });
  }

  // Deduplicate and sort
  const unique = Array.from(new Map(transactions.map(t => [t.tx_hash, t])).values());
  return unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
    transactions,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = Date.now();
  const currentMonth = getCurrentYearMonth();
  
  console.log('🚀 Trader Monthly JSON Update Script');
  console.log('====================================\n');
  console.log(`Target month: ${currentMonth}\n`);

  // Validate environment
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error('❌ ARBISCAN_API_KEY not found');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = await createSupabaseClient();

  // Fetch all profiles with wallet addresses
  const { data: profiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id, wallet_address')
    .not('wallet_address', 'is', null);

  if (fetchError) {
    console.error('❌ Failed to fetch profiles:', fetchError.message);
    process.exit(1);
  }

  if (!profiles || profiles.length === 0) {
    console.log('No trader wallets found');
    process.exit(0);
  }

  console.log(`Found ${profiles.length} trader wallet(s) to update\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const profile of profiles) {
    const walletAddress = profile.wallet_address;
    const walletLower = walletAddress.toLowerCase();

    try {
      console.log(`\n📊 Processing ${walletAddress.slice(0, 10)}...`);

      const { native, tokens } = await fetchAllTransactions(walletAddress, apiKey);
      const transactions = processTransactionsForMonth(native, tokens, walletAddress, currentMonth);
      console.log(`  Found ${transactions.length} transaction(s) for ${currentMonth}`);

      const monthData = buildMonthData(walletAddress, currentMonth, transactions);

      const { error } = await supabase
        .from(HISTORY_TABLE)
        .upsert(
          {
            wallet_address: walletLower,
            year_month: currentMonth,
            data: monthData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'wallet_address,year_month' }
        );

      if (error) throw new Error(error.message);
      console.log(`  ✅ Upserted ${walletLower}/${currentMonth} to Supabase`);
      successCount++;

      if (profiles.length > 1) {
        await sleep(500);
      }
    } catch (error) {
      console.error(`  ❌ Error processing ${walletAddress}:`, error.message);
      errorCount++;
    }
  }

  // Summary
  console.log('\n================================');
  console.log('📋 Summary\n');
  console.log(`  Wallets processed: ${profiles.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Duration: ${Date.now() - startTime}ms`);

  if (errorCount > 0) {
    process.exit(1);
  }

  console.log('\n✅ Update complete!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
