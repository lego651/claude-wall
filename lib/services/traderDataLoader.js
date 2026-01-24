/**
 * Trader Data Loader
 * 
 * Utility functions for loading trader transaction data
 * from JSON files and Supabase.
 */

import fs from 'fs';
import path from 'path';

const TRADERS_DIR = path.join(process.cwd(), 'data', 'traders');

/**
 * Load monthly JSON file for a trader wallet
 * 
 * @param {string} walletAddress - Wallet address
 * @param {string} yearMonth - Period in YYYY-MM format
 * @returns {Object|null} Monthly data or null if not found
 */
export function loadTraderMonthlyData(walletAddress, yearMonth) {
  const filePath = path.join(TRADERS_DIR, walletAddress.toLowerCase(), `${yearMonth}.json`);
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[TraderDataLoader] Error loading ${filePath}:`, err.message);
  }
  
  return null;
}

/**
 * Get list of available months for a trader wallet
 * 
 * @param {string} walletAddress - Wallet address
 * @returns {Array<string>} Array of YYYY-MM strings
 */
export function getTraderAvailableMonths(walletAddress) {
  const walletDir = path.join(TRADERS_DIR, walletAddress.toLowerCase());
  
  try {
    if (fs.existsSync(walletDir)) {
      const files = fs.readdirSync(walletDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse(); // Most recent first
    }
  } catch (err) {
    console.error(`[TraderDataLoader] Error reading ${walletDir}:`, err.message);
  }
  
  return [];
}

/**
 * Load transaction data for a specific period
 * 
 * @param {string} walletAddress - Wallet address
 * @param {string} period - '30d' or '12m'
 * @returns {Object} Aggregated data with summary, dailyBuckets, monthlyBuckets, transactions
 */
export function loadTraderPeriodData(walletAddress, period) {
  const now = new Date();
  const walletLower = walletAddress.toLowerCase();
  
  if (period === '30d') {
    // Load current month and previous month (to cover 30 days)
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    
    const currentData = loadTraderMonthlyData(walletLower, currentMonth);
    const prevData = loadTraderMonthlyData(walletLower, prevMonth);
    
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
      transactions: allTransactions,
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
      const data = loadTraderMonthlyData(walletLower, yearMonth);
      const [year, month] = yearMonth.split('-');
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
      
      if (data) {
        const monthTotal = data.summary?.totalPayouts || 0;
        monthlyBuckets.push({
          month: monthLabel,
          total: Math.round(monthTotal),
        });
        
        summary.totalPayouts += monthTotal;
        summary.payoutCount += data.summary?.payoutCount || 0;
        summary.largestPayout = Math.max(summary.largestPayout, data.summary?.largestPayout || 0);
      } else {
        monthlyBuckets.push({
          month: monthLabel,
          total: 0,
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
  
  return { summary: {}, dailyBuckets: [], monthlyBuckets: [], transactions: [] };
}

/**
 * Get all transactions for a trader wallet from JSON files
 * 
 * @param {string} walletAddress - Wallet address
 * @param {number} limit - Optional limit on number of transactions
 * @returns {Array} All transactions sorted by timestamp (newest first)
 */
export function getAllTraderTransactions(walletAddress, limit = null) {
  const walletLower = walletAddress.toLowerCase();
  const months = getTraderAvailableMonths(walletLower);
  const allTransactions = [];
  
  for (const yearMonth of months) {
    const monthData = loadTraderMonthlyData(walletLower, yearMonth);
    if (monthData?.transactions) {
      allTransactions.push(...monthData.transactions);
    }
  }
  
  // Sort by timestamp (newest first)
  const sorted = allTransactions.sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  return limit ? sorted.slice(0, limit) : sorted;
}
