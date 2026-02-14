/**
 * Payout Data Loader
 * 
 * PP2-012: Utility functions for loading and merging payout data
 * from JSON files and Supabase.
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '@/lib/logger';
import { cache } from '@/lib/cache';

const log = createLogger({ context: 'payoutDataLoader' });
const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'propfirms');
const LARGE_FILE_THRESHOLD_BYTES = 500 * 1024; // 500KB - log when loading larger files
const CACHE_TTL_MONTHLY = 300;

/**
 * Load monthly JSON file for a firm (with optional KV cache, 5 min TTL).
 *
 * @param {string} firmId - Firm identifier
 * @param {string} yearMonth - Period in YYYY-MM format
 * @returns {Promise<Object|null>} Monthly data or null if not found
 */
export async function loadMonthlyData(firmId, yearMonth) {
  const cacheKey = `payout:${firmId}:${yearMonth}`;
  const cached = await cache.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  const filePath = path.join(PAYOUTS_DIR, firmId, `${yearMonth}.json`);
  const relPath = path.relative(process.cwd(), filePath);

  try {
    const exists = await fs.promises.access(filePath).then(() => true).catch(() => false);
    if (!exists) return null;

    const stat = await fs.promises.stat(filePath);
    if (stat.size > LARGE_FILE_THRESHOLD_BYTES) {
      log.warn(
        { firmId, yearMonth, path: relPath, sizeBytes: stat.size, sizeKB: Math.round(stat.size / 1024) },
        'Loading large payout file (>500KB)'
      );
    }
    const content = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    await cache.set(cacheKey, data, CACHE_TTL_MONTHLY);
    return data;
  } catch (err) {
    log.error({ path: relPath, error: err.message }, 'Error loading payout file');
    return null;
  }
}

/**
 * Get list of available months for a firm
 * 
 * @param {string} firmId - Firm identifier
 * @returns {Array<string>} Array of YYYY-MM strings
 */
export function getAvailableMonths(firmId) {
  const firmDir = path.join(PAYOUTS_DIR, firmId);
  
  try {
    if (fs.existsSync(firmDir)) {
      const files = fs.readdirSync(firmDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse(); // Most recent first
    }
  } catch (err) {
    log.error({ firmId, path: path.relative(process.cwd(), firmDir), error: err.message }, 'Error reading firm dir');
  }

  return [];
}

/**
 * Load data for a specific period
 *
 * @param {string} firmId - Firm identifier
 * @param {string} period - '7d', '30d' or '12m'
 * @returns {Promise<Object>} Aggregated data with summary, dailyBuckets, monthlyBuckets
 */
export async function loadPeriodData(firmId, period) {
  const now = new Date();
  const months = getAvailableMonths(firmId);

  if (period === '7d') {
    // Load current month (7 days will always be within current + previous month at most)
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const currentData = await loadMonthlyData(firmId, currentMonth);
    const prevData = await loadMonthlyData(firmId, prevMonth);
    
    // Filter to last 7 days
    const cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    // Combine and filter daily buckets
    const allDailyBuckets = [];
    if (prevData?.dailyBuckets) {
      allDailyBuckets.push(...prevData.dailyBuckets);
    }
    if (currentData?.dailyBuckets) {
      allDailyBuckets.push(...currentData.dailyBuckets);
    }
    
    const filteredBuckets = allDailyBuckets
      .filter(b => b.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Get transactions for accurate metrics
    const allTransactions = [];
    if (prevData?.transactions) {
      allTransactions.push(...prevData.transactions.filter(t => t.timestamp >= cutoffDate.toISOString()));
    }
    if (currentData?.transactions) {
      allTransactions.push(...currentData.transactions.filter(t => t.timestamp >= cutoffDate.toISOString()));
    }
    
    const summary = {
      totalPayouts: allTransactions.reduce((sum, t) => sum + t.amount, 0),
      payoutCount: allTransactions.length,
      largestPayout: allTransactions.length > 0 
        ? Math.max(...allTransactions.map(t => t.amount)) 
        : 0,
    };
    summary.avgPayout = summary.payoutCount > 0 
      ? Math.round(summary.totalPayouts / summary.payoutCount) 
      : 0;
    
    return {
      summary,
      dailyBuckets: filteredBuckets,
      transactions: allTransactions.slice(0, 100),
    };
  }
  
  if (period === '30d') {
    // Load current month and previous month (to cover 30 days)
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const currentData = await loadMonthlyData(firmId, currentMonth);
    const prevData = await loadMonthlyData(firmId, prevMonth);
    
    // Combine daily buckets from both months
    const allDailyBuckets = [];
    
    if (prevData?.dailyBuckets) {
      allDailyBuckets.push(...prevData.dailyBuckets);
    }
    if (currentData?.dailyBuckets) {
      allDailyBuckets.push(...currentData.dailyBuckets);
    }
    
    // Filter to last 30 days
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    const filteredBuckets = allDailyBuckets
      .filter(b => b.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate summary from filtered buckets
    const summary = {
      totalPayouts: 0,
      payoutCount: 0,
      largestPayout: 0,
    };
    
    // We need transactions to get accurate count and largest
    const allTransactions = [];
    if (prevData?.transactions) {
      allTransactions.push(...prevData.transactions.filter(t => t.timestamp >= cutoffDate.toISOString()));
    }
    if (currentData?.transactions) {
      allTransactions.push(...currentData.transactions.filter(t => t.timestamp >= cutoffDate.toISOString()));
    }
    
    summary.payoutCount = allTransactions.length;
    summary.totalPayouts = allTransactions.reduce((sum, t) => sum + t.amount, 0);
    summary.largestPayout = allTransactions.length > 0 
      ? Math.max(...allTransactions.map(t => t.amount)) 
      : 0;
    summary.avgPayout = summary.payoutCount > 0 
      ? Math.round(summary.totalPayouts / summary.payoutCount) 
      : 0;
    
    return {
      summary,
      dailyBuckets: filteredBuckets,
      transactions: allTransactions.slice(0, 100), // Limit for performance
    };
  }
  
  if (period === '12m') {
    // Load last 12 months
    const monthsToLoad = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsToLoad.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    
    const monthlyBuckets = [];
    const summary = {
      totalPayouts: 0,
      payoutCount: 0,
      largestPayout: 0,
    };
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (const yearMonth of monthsToLoad.reverse()) { // Oldest first
      const data = await loadMonthlyData(firmId, yearMonth);
      const [year, month] = yearMonth.split('-');
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
      
      if (data) {
        monthlyBuckets.push({
          month: monthLabel,
          total: Math.round(data.summary.totalPayouts),
          rise: data.dailyBuckets?.reduce((sum, d) => sum + (d.rise || 0), 0) || 0,
          crypto: data.dailyBuckets?.reduce((sum, d) => sum + (d.crypto || 0), 0) || 0,
          wire: data.dailyBuckets?.reduce((sum, d) => sum + (d.wire || 0), 0) || 0,
        });
        
        summary.totalPayouts += data.summary.totalPayouts;
        summary.payoutCount += data.summary.payoutCount;
        summary.largestPayout = Math.max(summary.largestPayout, data.summary.largestPayout);
      } else {
        monthlyBuckets.push({
          month: monthLabel,
          total: 0,
          rise: 0,
          crypto: 0,
          wire: 0,
        });
      }
    }
    
    summary.avgPayout = summary.payoutCount > 0 
      ? Math.round(summary.totalPayouts / summary.payoutCount) 
      : 0;
    
    return {
      summary,
      monthlyBuckets,
    };
  }
  
  return { summary: {}, dailyBuckets: [], monthlyBuckets: [] };
}

/**
 * Get top payouts from JSON files
 *
 * @param {string} firmId - Firm identifier
 * @param {string} period - '30d' or '12m'
 * @param {number} limit - Number of payouts to return
 * @returns {Promise<Array>} Top payouts sorted by amount
 */
export async function getTopPayoutsFromFiles(firmId, period, limit = 10) {
  // For 30d, do NOT rely on loadPeriodData().transactions because it is intentionally capped
  // (used for chart performance). Instead, load transactions directly from month files.
  if (period === '30d') {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const currentData = await loadMonthlyData(firmId, currentMonth);
    const prevData = await loadMonthlyData(firmId, prevMonth);

    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const allTransactions = [
      ...(prevData?.transactions || []),
      ...(currentData?.transactions || []),
    ].filter(t => t.timestamp >= cutoffDate);

    return allTransactions
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
      .map(t => ({
        id: t.tx_hash,
        date: t.timestamp.split('T')[0],
        amount: Math.round(t.amount),
        paymentMethod: t.payment_method,
        txHash: t.tx_hash,
        arbiscanUrl: `https://arbiscan.io/tx/${t.tx_hash}`,
      }));
  }
  
  if (period === '12m') {
    // Need to load all transactions from all months
    const months = getAvailableMonths(firmId).slice(0, 12);
    const allTransactions = [];

    for (const yearMonth of months) {
      const monthData = await loadMonthlyData(firmId, yearMonth);
      if (monthData?.transactions) {
        allTransactions.push(...monthData.transactions);
      }
    }
    
    return allTransactions
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
      .map(t => ({
        id: t.tx_hash,
        date: t.timestamp.split('T')[0],
        amount: Math.round(t.amount),
        paymentMethod: t.payment_method,
        txHash: t.tx_hash,
        arbiscanUrl: `https://arbiscan.io/tx/${t.tx_hash}`,
      }));
  }
  
  return [];
}
