/**
 * Payout Data Loader
 * 
 * PP2-012: Utility functions for loading and merging payout data
 * from JSON files and Supabase.
 */

import fs from 'fs';
import path from 'path';

const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'payouts');

/**
 * Load monthly JSON file for a firm
 * 
 * @param {string} firmId - Firm identifier
 * @param {string} yearMonth - Period in YYYY-MM format
 * @returns {Object|null} Monthly data or null if not found
 */
export function loadMonthlyData(firmId, yearMonth) {
  const filePath = path.join(PAYOUTS_DIR, firmId, `${yearMonth}.json`);
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[DataLoader] Error loading ${filePath}:`, err.message);
  }
  
  return null;
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
    console.error(`[DataLoader] Error reading ${firmDir}:`, err.message);
  }
  
  return [];
}

/**
 * Load data for a specific period
 * 
 * @param {string} firmId - Firm identifier
 * @param {string} period - '30d' or '12m'
 * @returns {Object} Aggregated data with summary, dailyBuckets, monthlyBuckets
 */
export function loadPeriodData(firmId, period) {
  const now = new Date();
  const months = getAvailableMonths(firmId);
  
  if (period === '30d') {
    // Load current month and previous month (to cover 30 days)
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const currentData = loadMonthlyData(firmId, currentMonth);
    const prevData = loadMonthlyData(firmId, prevMonth);
    
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
      const data = loadMonthlyData(firmId, yearMonth);
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
 * @returns {Array} Top payouts sorted by amount
 */
export function getTopPayoutsFromFiles(firmId, period, limit = 10) {
  const data = loadPeriodData(firmId, period);
  
  if (period === '30d' && data.transactions) {
    return data.transactions
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
      const monthData = loadMonthlyData(firmId, yearMonth);
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
