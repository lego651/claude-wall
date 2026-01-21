#!/usr/bin/env node

/**
 * Update Monthly JSON Files
 * 
 * Fetches current month's payout data from Arbiscan and updates
 * the corresponding JSON files. Designed to run daily via GitHub Actions.
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
const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'payouts');

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

function processTransactionsForMonth(native, tokens, addresses, firmId, yearMonth) {
  const lowerAddresses = addresses.map(a => a.toLowerCase());
  const monthStart = getMonthStartTimestamp(yearMonth);
  const [year, month] = yearMonth.split('-').map(Number);
  const monthEnd = new Date(year, month, 1, 0, 0, 0, 0).getTime() / 1000; // Start of next month
  
  const payouts = [];

  // Process native ETH (outgoing)
  for (const tx of native) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;
    
    const timestamp = parseInt(tx.timeStamp);
    if (timestamp < monthStart || timestamp >= monthEnd) continue; // Only this month
    
    const amount = parseFloat(tx.value) / 1e18;
    const amountUSD = amount * PRICES.ETH;
    if (amountUSD < 10) continue; // Skip spam
    
    payouts.push({
      tx_hash: tx.hash,
      firm_id: firmId,
      amount: amountUSD,
      payment_method: 'crypto',
      timestamp: new Date(timestamp * 1000).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  // Process tokens (outgoing)
  for (const tx of tokens) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;
    
    const timestamp = parseInt(tx.timeStamp);
    if (timestamp < monthStart || timestamp >= monthEnd) continue; // Only this month
    
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
      timestamp: new Date(timestamp * 1000).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  // Deduplicate
  const unique = Array.from(new Map(payouts.map(p => [p.tx_hash, p])).values());
  return unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function buildMonthData(firmId, yearMonth, transactions) {
  // Calculate summary
  const amounts = transactions.map(t => t.amount);
  const summary = {
    totalPayouts: Math.round(amounts.reduce((a, b) => a + b, 0)),
    payoutCount: transactions.length,
    largestPayout: Math.round(amounts.length > 0 ? Math.max(...amounts) : 0),
    avgPayout: Math.round(amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0),
  };

  // Build daily buckets
  const dailyMap = {};
  for (const t of transactions) {
    const day = t.timestamp.split('T')[0];
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

async function updateFirmMonth(firm, yearMonth, apiKey) {
  console.log(`\n📊 Updating ${firm.name} for ${yearMonth}...`);
  
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
  
  // Process transactions for this month only
  const transactions = processTransactionsForMonth(
    allNative, 
    allTokens, 
    firm.addresses, 
    firm.id, 
    yearMonth
  );
  
  console.log(`  Processed ${transactions.length} payouts for ${yearMonth}`);
  
  if (transactions.length === 0) {
    console.log('  No payouts for this month');
    return { firm: firm.id, payouts: 0, changed: false };
  }
  
  // Load existing data to compare
  const existing = loadExistingMonthData(firm.id, yearMonth);
  const existingCount = existing?.summary?.payoutCount || 0;
  
  // Build new month data
  const monthData = buildMonthData(firm.id, yearMonth, transactions);
  
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
  
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error('❌ ARBISCAN_API_KEY not found in environment');
    process.exit(1);
  }
  
  const yearMonth = getCurrentYearMonth();
  console.log(`📅 Updating data for: ${yearMonth}\n`);
  
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
      const result = await updateFirmMonth(firm, yearMonth, apiKey);
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
