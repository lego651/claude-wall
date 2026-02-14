#!/usr/bin/env node

/**
 * Update Monthly JSON Files
 * 
 * Fetches current month's payout data from Arbiscan and updates
 * the corresponding JSON files. Designed to run daily via GitHub Actions.
 * 
 * Daily buckets are grouped by the firm's local timezone for accurate business day reporting.
 * 
 * This script only updates the CURRENT month's file for each firm,
 * making it fast and efficient for daily runs.
 * 
 * Usage:
 *   node scripts/update-monthly-json.js
 *   node scripts/update-monthly-json.js --firm fundingpips
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
const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'propfirms');

// Token config
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];
const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00, RISEPAY: 1.00 };
const TOKEN_TO_METHOD = { RISEPAY: 'rise', USDC: 'crypto', USDT: 'crypto', ETH: 'crypto' };

// Parse command line args
const args = process.argv.slice(2);
const firmFilter = args.includes('--firm') ? args[args.indexOf('--firm') + 1] : null;

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert UTC timestamp to local date string in firm's timezone
 * @param {string} utcTimestamp - ISO timestamp in UTC
 * @param {string} timezone - IANA timezone (e.g., 'Asia/Dubai')
 * @returns {string} Date string in YYYY-MM-DD format (local time)
 */
function getLocalDate(utcTimestamp, timezone) {
  const date = new Date(utcTimestamp);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Get year-month key in firm's local timezone
 * @param {string} utcTimestamp - ISO timestamp in UTC
 * @param {string} timezone - IANA timezone
 * @returns {string} Year-month in YYYY-MM format (local time)
 */
function getLocalYearMonth(utcTimestamp, timezone) {
  const localDate = getLocalDate(utcTimestamp, timezone);
  return localDate.slice(0, 7);
}

/**
 * Get current year-month in a specific timezone
 * @param {string} timezone - IANA timezone
 * @returns {string} Year-month in YYYY-MM format
 */
function getCurrentYearMonthInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now).slice(0, 7);
}

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthStartTimestamp(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1, 0, 0, 0, 0).getTime() / 1000;
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
 * Process transactions and filter to a specific month in firm's local timezone
 * @param {Array} native - Native ETH transactions
 * @param {Array} tokens - Token transactions
 * @param {Array} addresses - Firm wallet addresses
 * @param {string} firmId - Firm identifier
 * @param {string} yearMonth - Target month in YYYY-MM format
 * @param {string} timezone - IANA timezone for the firm
 * @returns {Array} Filtered and processed payouts
 */
function processTransactionsForMonth(native, tokens, addresses, firmId, yearMonth, timezone = 'UTC') {
  const lowerAddresses = addresses.map(a => a.toLowerCase());
  const payouts = [];

  // Process native ETH (outgoing)
  for (const tx of native) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;
    
    const timestamp = parseInt(tx.timeStamp);
    const isoTimestamp = new Date(timestamp * 1000).toISOString();
    
    // Filter by month in firm's local timezone
    const txYearMonth = getLocalYearMonth(isoTimestamp, timezone);
    if (txYearMonth !== yearMonth) continue;
    
    const amount = parseFloat(tx.value) / 1e18;
    const amountUSD = amount * PRICES.ETH;
    if (amountUSD < 10) continue; // Skip spam
    
    payouts.push({
      tx_hash: tx.hash,
      firm_id: firmId,
      amount: amountUSD,
      payment_method: 'crypto',
      timestamp: isoTimestamp,
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  // Process tokens (outgoing)
  for (const tx of tokens) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;
    
    const timestamp = parseInt(tx.timeStamp);
    const isoTimestamp = new Date(timestamp * 1000).toISOString();
    
    // Filter by month in firm's local timezone
    const txYearMonth = getLocalYearMonth(isoTimestamp, timezone);
    if (txYearMonth !== yearMonth) continue;
    
    if (!SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase())) continue;
    
    const decimals = parseInt(tx.tokenDecimal) || 18;
    const amount = parseFloat(tx.value) / Math.pow(10, decimals);
    const token = tx.tokenSymbol.toUpperCase();
    const amountUSD = amount * (PRICES[token] || 1);
    if (amountUSD < 10) continue; // Skip spam
    
    payouts.push({
      tx_hash: tx.hash,
      firm_id: firmId,
      amount: amountUSD,
      payment_method: TOKEN_TO_METHOD[token] || 'crypto',
      timestamp: isoTimestamp,
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  // Deduplicate
  const unique = Array.from(new Map(payouts.map(p => [p.tx_hash, p])).values());
  return unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Build month data with daily buckets in firm's local timezone
 * @param {string} firmId - Firm identifier
 * @param {string} yearMonth - Year-month in YYYY-MM format
 * @param {Array} transactions - Array of transaction objects
 * @param {string} timezone - IANA timezone for the firm
 * @returns {Object} Month data object
 */
function buildMonthData(firmId, yearMonth, transactions, timezone = 'UTC') {
  // Calculate summary
  const amounts = transactions.map(t => t.amount);
  const summary = {
    totalPayouts: Math.round(amounts.reduce((a, b) => a + b, 0)),
    payoutCount: transactions.length,
    largestPayout: Math.round(amounts.length > 0 ? Math.max(...amounts) : 0),
    avgPayout: Math.round(amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0),
  };

  // Build daily buckets using firm's local timezone
  const dailyMap = {};
  for (const t of transactions) {
    const day = getLocalDate(t.timestamp, timezone);
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, total: 0, rise: 0, crypto: 0, wire: 0 };
    }
    dailyMap[day].total += t.amount;
    dailyMap[day][t.payment_method] = (dailyMap[day][t.payment_method] || 0) + t.amount;
  }

  // Round daily bucket values
  const dailyBuckets = Object.values(dailyMap)
    .map(d => ({
      date: d.date,
      total: Math.round(d.total),
      rise: Math.round(d.rise),
      crypto: Math.round(d.crypto),
      wire: Math.round(d.wire),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    firmId,
    period: yearMonth,
    timezone: timezone,
    generatedAt: new Date().toISOString(),
    summary,
    dailyBuckets,
    transactions,
  };
}

// ============================================================================
// File Operations
// ============================================================================

function loadExistingMonthData(firmId, yearMonth) {
  const filePath = path.join(PAYOUTS_DIR, firmId, `${yearMonth}.json`);
  
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.log(`  Warning: Could not parse existing file, will recreate`);
    }
  }
  
  return null;
}

function saveMonthData(firmId, yearMonth, data) {
  const firmDir = path.join(PAYOUTS_DIR, firmId);
  
  if (!fs.existsSync(firmDir)) {
    fs.mkdirSync(firmDir, { recursive: true });
  }
  
  const filePath = path.join(firmDir, `${yearMonth}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  
  return filePath;
}

// ============================================================================
// Main Update Logic
// ============================================================================

async function updateFirmMonth(firm, apiKey) {
  const timezone = firm.timezone || 'UTC';
  // Get current month in firm's local timezone
  const yearMonth = getCurrentYearMonthInTimezone(timezone);
  
  console.log(`\n📊 Updating ${firm.name} for ${yearMonth} (timezone: ${timezone})...`);
  
  // Fetch all transactions
  let allNative = [];
  let allTokens = [];
  
  for (const address of firm.addresses) {
    const { native, tokens } = await fetchAllTransactions(address, apiKey);
    allNative = [...allNative, ...native];
    allTokens = [...allTokens, ...tokens];
    await sleep(500); // Rate limit between addresses
  }
  
  console.log(`  Found ${allNative.length} native + ${allTokens.length} token transactions`);
  
  // Process transactions for this month only (using firm's timezone)
  const transactions = processTransactionsForMonth(
    allNative, 
    allTokens, 
    firm.addresses, 
    firm.id, 
    yearMonth,
    timezone
  );
  
  console.log(`  Processed ${transactions.length} payouts for ${yearMonth}`);
  
  if (transactions.length === 0) {
    console.log('  No payouts for this month');
    return { firm: firm.id, payouts: 0, changed: false };
  }
  
  // Load existing data to compare
  const existing = loadExistingMonthData(firm.id, yearMonth);
  const existingCount = existing?.summary?.payoutCount || 0;
  
  // Build new month data (using firm's timezone for daily buckets)
  const monthData = buildMonthData(firm.id, yearMonth, transactions, timezone);
  
  // Check if anything changed
  if (existingCount === monthData.summary.payoutCount) {
    console.log(`  No new payouts (still ${existingCount})`);
    return { firm: firm.id, payouts: transactions.length, changed: false };
  }
  
  // Save updated data
  const filePath = saveMonthData(firm.id, yearMonth, monthData);
  console.log(`  ✅ Saved ${filePath}`);
  console.log(`     ${existingCount} → ${monthData.summary.payoutCount} payouts`);
  console.log(`     Total: $${monthData.summary.totalPayouts.toLocaleString()}`);
  
  return { 
    firm: firm.id, 
    payouts: transactions.length, 
    changed: true,
    newPayouts: monthData.summary.payoutCount - existingCount,
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🚀 Update Monthly JSON Files');
  console.log('============================\n');
  console.log('📝 Daily buckets use each firm\'s local timezone\n');
  
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error('❌ ARBISCAN_API_KEY not found in environment');
    process.exit(1);
  }
  
  // Load firms from JSON
  const firmsPath = path.join(process.cwd(), 'data', 'propfirms.json');
  const firmsData = JSON.parse(fs.readFileSync(firmsPath, 'utf8'));
  let firms = firmsData.firms;
  
  if (firmFilter) {
    firms = firms.filter(f => f.id === firmFilter);
    if (firms.length === 0) {
      console.error(`❌ Firm "${firmFilter}" not found`);
      process.exit(1);
    }
  }
  
  console.log(`Found ${firms.length} firm(s) to update`);
  
  // Update each firm
  const results = [];
  for (const firm of firms) {
    try {
      const result = await updateFirmMonth(firm, apiKey);
      results.push(result);
    } catch (err) {
      console.error(`❌ Error updating ${firm.name}:`, err.message);
      results.push({ firm: firm.id, error: err.message });
    }
    
    await sleep(2000); // Rate limit between firms
  }
  
  // Summary
  console.log('\n============================');
  console.log('📋 Summary\n');
  
  let totalChanged = 0;
  let totalNewPayouts = 0;
  
  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.firm}: ${r.error}`);
    } else if (r.changed) {
      console.log(`  ✅ ${r.firm}: +${r.newPayouts} new payouts`);
      totalChanged++;
      totalNewPayouts += r.newPayouts;
    } else {
      console.log(`  ⏸️  ${r.firm}: no changes`);
    }
  }
  
  console.log(`\nFiles updated: ${totalChanged}`);
  console.log(`New payouts added: ${totalNewPayouts}`);
  console.log('\n✅ Update complete!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
