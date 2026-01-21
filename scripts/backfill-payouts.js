#!/usr/bin/env node

/**
 * Backfill Payouts Script
 * 
 * Fetches all historical payout data from Arbiscan and saves to JSON files.
 * Daily buckets are grouped by the firm's local timezone for accurate business day reporting.
 * 
 * Usage:
 *   node scripts/backfill-payouts.js
 *   node scripts/backfill-payouts.js --firm fundingpips
 * 
 * Requires:
 *   ARBISCAN_API_KEY in .env or environment
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file manually
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

const ARBISCAN_API_BASE = 'https://api.etherscan.io/v2/api';
const ARBITRUM_CHAIN_ID = '42161';
const API_KEY = process.env.ARBISCAN_API_KEY;

// Token config
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];
const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00, RISEPAY: 1.00 };
const TOKEN_TO_METHOD = { RISEPAY: 'rise', USDC: 'crypto', USDT: 'crypto', ETH: 'crypto' };

// Parse command line args
const args = process.argv.slice(2);
const firmFilter = args.includes('--firm') ? args[args.indexOf('--firm') + 1] : null;

// Calculate cutoff date (12 months ago)
const MONTHS_TO_KEEP = 12;
const cutoffDate = new Date();
cutoffDate.setMonth(cutoffDate.getMonth() - MONTHS_TO_KEEP);
cutoffDate.setDate(1);
cutoffDate.setHours(0, 0, 0, 0);
const CUTOFF_TIMESTAMP = cutoffDate.getTime() / 1000;

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllTransactions(address) {
  console.log(`  Fetching native transactions for ${address.slice(0, 10)}...`);
  const nativeUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${API_KEY}`;
  const native = await fetchWithRetry(nativeUrl);
  
  await sleep(300); // Rate limit
  
  console.log(`  Fetching token transactions for ${address.slice(0, 10)}...`);
  const tokenUrl = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${API_KEY}`;
  const tokens = await fetchWithRetry(tokenUrl);
  
  return { native, tokens };
}

function processTransactions(native, tokens, addresses, firmId) {
  const lowerAddresses = addresses.map(a => a.toLowerCase());
  const payouts = [];

  // Process native ETH (outgoing)
  for (const tx of native) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;
    if (parseInt(tx.timeStamp) < CUTOFF_TIMESTAMP) continue; // Skip old transactions
    
    const amount = parseFloat(tx.value) / 1e18;
    const amountUSD = amount * PRICES.ETH;
    if (amountUSD < 10) continue; // Skip spam
    
    payouts.push({
      tx_hash: tx.hash,
      firm_id: firmId,
      amount: amountUSD,
      payment_method: 'crypto',
      timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  // Process tokens (outgoing)
  for (const tx of tokens) {
    if (!tx.from || !lowerAddresses.includes(tx.from.toLowerCase())) continue;
    if (parseInt(tx.timeStamp) < CUTOFF_TIMESTAMP) continue; // Skip old transactions
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
      timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  // Deduplicate
  const unique = Array.from(new Map(payouts.map(p => [p.tx_hash, p])).values());
  return unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Convert UTC timestamp to local date string in firm's timezone
 * @param {string} utcTimestamp - ISO timestamp in UTC
 * @param {string} timezone - IANA timezone (e.g., 'Asia/Dubai')
 * @returns {string} Date string in YYYY-MM-DD format (local time)
 */
function getLocalDate(utcTimestamp, timezone) {
  const date = new Date(utcTimestamp);
  // Use Intl.DateTimeFormat to get the date in the firm's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Returns YYYY-MM-DD format
}

/**
 * Get year-month key in firm's local timezone
 * @param {string} utcTimestamp - ISO timestamp in UTC
 * @param {string} timezone - IANA timezone
 * @returns {string} Year-month in YYYY-MM format (local time)
 */
function getLocalYearMonth(utcTimestamp, timezone) {
  const localDate = getLocalDate(utcTimestamp, timezone);
  return localDate.slice(0, 7); // YYYY-MM
}

/**
 * Group payouts by month using firm's local timezone
 * @param {Array} payouts - Array of payout objects
 * @param {string} timezone - IANA timezone for the firm
 * @returns {Object} Payouts grouped by month
 */
function groupByMonth(payouts, timezone = 'UTC') {
  const months = {};
  
  for (const p of payouts) {
    // Use firm's local timezone for grouping
    const key = getLocalYearMonth(p.timestamp, timezone);
    const dayKey = getLocalDate(p.timestamp, timezone);
    
    if (!months[key]) {
      months[key] = {
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: {},
        transactions: [],
      };
    }
    
    const month = months[key];
    month.summary.totalPayouts += p.amount;
    month.summary.payoutCount += 1;
    month.summary.largestPayout = Math.max(month.summary.largestPayout, p.amount);
    month.transactions.push(p);
    
    // Daily bucket (using local date)
    if (!month.dailyBuckets[dayKey]) {
      month.dailyBuckets[dayKey] = { total: 0, rise: 0, crypto: 0, wire: 0 };
    }
    month.dailyBuckets[dayKey].total += p.amount;
    month.dailyBuckets[dayKey][p.payment_method] += p.amount;
  }
  
  return months;
}

async function backfillFirm(firm) {
  const timezone = firm.timezone || 'UTC';
  console.log(`\n📊 Backfilling ${firm.name} (timezone: ${timezone})...`);
  
  let allNative = [];
  let allTokens = [];
  
  for (const address of firm.addresses) {
    const { native, tokens } = await fetchAllTransactions(address);
    allNative = [...allNative, ...native];
    allTokens = [...allTokens, ...tokens];
    await sleep(500); // Rate limit between addresses
  }
  
  console.log(`  Found ${allNative.length} native + ${allTokens.length} token transactions`);
  
  const payouts = processTransactions(allNative, allTokens, firm.addresses, firm.id);
  console.log(`  Processed ${payouts.length} payouts`);
  
  if (payouts.length === 0) {
    console.log('  No payouts to save');
    return { firm: firm.id, payouts: 0, months: 0 };
  }
  
  // Group by month using firm's local timezone
  const months = groupByMonth(payouts, timezone);
  const firmDir = path.join(process.cwd(), 'data', 'payouts', firm.id);
  
  if (!fs.existsSync(firmDir)) {
    fs.mkdirSync(firmDir, { recursive: true });
  }
  
  for (const [yearMonth, data] of Object.entries(months)) {
    const filePath = path.join(firmDir, `${yearMonth}.json`);
    
    // Convert daily buckets to array
    const dailyBuckets = Object.entries(data.dailyBuckets)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const fileData = {
      firmId: firm.id,
      period: yearMonth,
      timezone: timezone,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPayouts: Math.round(data.summary.totalPayouts),
        payoutCount: data.summary.payoutCount,
        largestPayout: Math.round(data.summary.largestPayout),
        avgPayout: Math.round(data.summary.totalPayouts / data.summary.payoutCount),
      },
      dailyBuckets,
      transactions: data.transactions,
    };
    
    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
    console.log(`  Saved ${yearMonth}: ${data.summary.payoutCount} payouts, $${Math.round(data.summary.totalPayouts).toLocaleString()}`);
  }
  
  return { firm: firm.id, payouts: payouts.length, months: Object.keys(months).length };
}

async function main() {
  console.log('🚀 Payout Backfill Script');
  console.log('========================\n');
  console.log(`📅 Data range: Last ${MONTHS_TO_KEEP} months (since ${cutoffDate.toISOString().split('T')[0]})\n`);
  
  if (!API_KEY) {
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
  
  console.log(`Found ${firms.length} firm(s) to backfill`);
  
  const results = [];
  for (const firm of firms) {
    try {
      const result = await backfillFirm(firm);
      results.push(result);
    } catch (err) {
      console.error(`❌ Error backfilling ${firm.name}:`, err.message);
      results.push({ firm: firm.id, error: err.message });
    }
    
    await sleep(2000); // Rate limit between firms
  }
  
  // Summary
  console.log('\n========================');
  console.log('📋 Summary\n');
  
  let totalPayouts = 0;
  let totalMonths = 0;
  
  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.firm}: ${r.error}`);
    } else {
      console.log(`  ✅ ${r.firm}: ${r.payouts} payouts across ${r.months} months`);
      totalPayouts += r.payouts;
      totalMonths += r.months;
    }
  }
  
  console.log(`\nTotal: ${totalPayouts} payouts, ${totalMonths} month files created`);
  console.log('\n✅ Backfill complete!');
}

main().catch(console.error);
