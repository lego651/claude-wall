/**
 * Trader Data Loader
 *
 * Loads trader transaction data from Supabase (primary) or JSON files (fallback).
 * Supabase stores monthly blobs in trader_payout_history so new users see data immediately.
 */

import fs from "fs";
import path from "path";

const TRADERS_DIR = path.join(process.cwd(), "data", "traders");
const HISTORY_TABLE = "trader_payout_history";

/**
 * Load one month for a wallet. Tries Supabase first if client provided, else reads from fs.
 * @param {string} walletAddress
 * @param {string} yearMonth - YYYY-MM
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase] - optional; when provided, read from Supabase
 * @returns {Promise<Object|null>}
 */
export async function loadTraderMonthlyData(walletAddress, yearMonth, supabase = null) {
  const walletLower = walletAddress.toLowerCase();

  if (supabase) {
    const { data, error } = await supabase
      .from(HISTORY_TABLE)
      .select("data")
      .eq("wallet_address", walletLower)
      .eq("year_month", yearMonth)
      .maybeSingle();

    if (error) return null;
    // Row shape: { data: <jsonb blob> }; blob has summary, dailyBuckets, transactions
    const blob = data?.data ?? data;
    if (blob && (blob.transactions || blob.summary)) return blob;
  }

  const filePath = path.join(TRADERS_DIR, walletLower, `${yearMonth}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[TraderDataLoader] Error loading ${filePath}:`, err.message);
  }
  return null;
}

/**
 * List available year-months for a wallet. Supabase first if client provided, else fs.
 */
export async function getTraderAvailableMonths(walletAddress, supabase = null) {
  const walletLower = walletAddress.toLowerCase();

  if (supabase) {
    const { data, error } = await supabase
      .from(HISTORY_TABLE)
      .select("year_month")
      .eq("wallet_address", walletLower)
      .order("year_month", { ascending: false });

    if (!error && data?.length) return data.map((r) => r.year_month);
  }

  const walletDir = path.join(TRADERS_DIR, walletLower);
  try {
    if (fs.existsSync(walletDir)) {
      const files = fs.readdirSync(walletDir);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
        .sort()
        .reverse();
    }
  } catch (err) {
    console.error(`[TraderDataLoader] Error reading ${walletDir}:`, err.message);
  }
  return [];
}

/**
 * Load period data (30d or 12m). Uses Supabase when client provided.
 */
export async function loadTraderPeriodData(walletAddress, period, supabase = null) {
  const now = new Date();
  const walletLower = walletAddress.toLowerCase();

  if (period === "30d") {
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const [currentData, prevData] = await Promise.all([
      loadTraderMonthlyData(walletLower, currentMonth, supabase),
      loadTraderMonthlyData(walletLower, prevMonth, supabase),
    ]);

    const allDailyBuckets = [
      ...(prevData?.dailyBuckets || []),
      ...(currentData?.dailyBuckets || []),
    ];
    const cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];
    const filteredBuckets = allDailyBuckets
      .filter((b) => b.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    const allTransactions = [];
    if (prevData?.transactions) {
      allTransactions.push(...prevData.transactions.filter((t) => t.timestamp >= cutoffDate.toISOString()));
    }
    if (currentData?.transactions) {
      allTransactions.push(...currentData.transactions.filter((t) => t.timestamp >= cutoffDate.toISOString()));
    }

    const summary = {
      totalPayouts: allTransactions.reduce((sum, t) => sum + t.amount, 0),
      payoutCount: allTransactions.length,
      largestPayout:
        allTransactions.length > 0 ? Math.max(...allTransactions.map((t) => t.amount)) : 0,
    };
    summary.avgPayout =
      summary.payoutCount > 0 ? Math.round(summary.totalPayouts / summary.payoutCount) : 0;

    return { summary, dailyBuckets: filteredBuckets, transactions: allTransactions };
  }

  if (period === "12m") {
    const monthsToLoad = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsToLoad.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const monthlyBuckets = [];
    const summary = { totalPayouts: 0, payoutCount: 0, largestPayout: 0 };
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const yearMonth of monthsToLoad.reverse()) {
      const data = await loadTraderMonthlyData(walletLower, yearMonth, supabase);
      const [year, month] = yearMonth.split("-");
      const monthLabel = `${monthNames[parseInt(month, 10) - 1]} ${year}`;

      if (data) {
        const monthTotal = data.summary?.totalPayouts || 0;
        monthlyBuckets.push({ month: monthLabel, total: Math.round(monthTotal) });
        summary.totalPayouts += monthTotal;
        summary.payoutCount += data.summary?.payoutCount || 0;
        summary.largestPayout = Math.max(summary.largestPayout, data.summary?.largestPayout || 0);
      } else {
        monthlyBuckets.push({ month: monthLabel, total: 0 });
      }
    }
    summary.avgPayout =
      summary.payoutCount > 0 ? Math.round(summary.totalPayouts / summary.payoutCount) : 0;
    return { summary, monthlyBuckets };
  }

  return { summary: {}, dailyBuckets: [], monthlyBuckets: [], transactions: [] };
}

/**
 * Get all transactions for a wallet. Supabase first when client provided.
 */
export async function getAllTraderTransactions(walletAddress, limit = null, supabase = null) {
  const walletLower = walletAddress.toLowerCase();
  const months = await getTraderAvailableMonths(walletLower, supabase);
  const allTransactions = [];

  for (const yearMonth of months) {
    const monthData = await loadTraderMonthlyData(walletLower, yearMonth, supabase);
    if (monthData?.transactions) allTransactions.push(...monthData.transactions);
  }

  const sorted = allTransactions.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  return limit ? sorted.slice(0, limit) : sorted;
}
