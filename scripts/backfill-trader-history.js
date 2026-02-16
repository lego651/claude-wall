#!/usr/bin/env node
/**
 * Backfill Trader History
 *
 * Fetches ALL historical incoming payouts for a trader wallet from Arbiscan,
 * groups by month (UTC), and upserts into Supabase trader_payout_history table.
 * Used on first wallet link (OAuth callback) and for manual retry via API.
 *
 * Usage:
 *   ARBISCAN_API_KEY=xxx NEXT_PUBLIC_SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/backfill-trader-history.js <walletAddress>
 *
 * Timeout: Caller typically uses 5 min (300000 ms). Handles pagination for 10k+ txs.
 */

import { fileURLToPath } from "url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllNativeTransactions,
  fetchAllTokenTransactions,
} from "@/lib/arbiscan";

const __filename = fileURLToPath(import.meta.url);

config();

const PRICES = { ETH: 2500, USDC: 1.0, USDT: 1.0, RISEPAY: 1.0 };
const SUPPORTED_TOKENS = ["USDC", "USDT", "RISEPAY"];
const TOKEN_TO_METHOD = {
  RISEPAY: "rise",
  USDC: "crypto",
  USDT: "crypto",
  ETH: "crypto",
};
const MIN_PAYOUT_USD = 10;
const DELAY_MS = 300;

function log(msg, ...args) {
  console.log(`[Backfill] ${msg}`, ...args);
}

function logError(msg, ...args) {
  console.error(`[Backfill] ${msg}`, ...args);
}

/**
 * Process raw Arbiscan data into payout records (incoming to wallet only).
 * Groups by month (UTC) and returns { monthlyData }.
 */
function processIncomingPayouts(nativeData, tokenData, walletAddress) {
  const walletLower = walletAddress.toLowerCase();
  const monthlyData = {};

  function addTx(tx, amountUSD, paymentMethod) {
    if (amountUSD < MIN_PAYOUT_USD) return;
    const date = new Date(parseInt(tx.timeStamp, 10) * 1000);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

    if (!monthlyData[month]) {
      monthlyData[month] = {
        transactions: [],
        summary: { totalPayouts: 0, payoutCount: 0 },
      };
    }

    const record = {
      tx_hash: tx.hash,
      wallet_address: walletLower,
      amount: amountUSD,
      payment_method: paymentMethod,
      timestamp: date.toISOString(),
      from_address: tx.from,
      to_address: tx.to,
    };

    monthlyData[month].transactions.push(record);
    monthlyData[month].summary.totalPayouts += amountUSD;
    monthlyData[month].summary.payoutCount += 1;
  }

  // Incoming native ETH (tx.to === wallet)
  (nativeData || []).forEach((tx) => {
    if (!tx.to || tx.to.toLowerCase() !== walletLower) return;
    const amount = parseFloat(tx.value, 10) / 1e18;
    const amountUSD = amount * PRICES.ETH;
    addTx(tx, amountUSD, "crypto");
  });

  // Incoming ERC-20 (tx.to === wallet, supported tokens only)
  (tokenData || []).forEach((tx) => {
    if (
      !tx.to ||
      tx.to.toLowerCase() !== walletLower ||
      !SUPPORTED_TOKENS.includes((tx.tokenSymbol || "").toUpperCase())
    )
      return;
    const decimals = parseInt(tx.tokenDecimal, 10) || 18;
    const amount = parseFloat(tx.value, 10) / Math.pow(10, decimals);
    const token = (tx.tokenSymbol || "").toUpperCase();
    const amountUSD = amount * (PRICES[token] ?? 1);
    addTx(tx, amountUSD, TOKEN_TO_METHOD[token] || "crypto");
  });

  return monthlyData;
}

/**
 * Build dailyBuckets from transactions (same shape as traderDataLoader expects).
 */
function buildDailyBuckets(transactions) {
  const byDate = new Map();
  for (const t of transactions) {
    const date = t.timestamp.split("T")[0];
    if (!byDate.has(date)) {
      byDate.set(date, { date, total: 0, rise: 0, crypto: 0, wire: 0 });
    }
    const b = byDate.get(date);
    b.total += t.amount;
    const method = t.payment_method || "crypto";
    b[method] = (b[method] || 0) + t.amount;
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function main() {
  const walletAddress = process.argv[2];
  if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    logError("Usage: node backfill-trader-history.js <walletAddress>");
    process.exit(1);
  }

  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    logError("Missing ARBISCAN_API_KEY in environment");
    process.exit(1);
  }

  const supabase = createServiceClient();
  const walletLower = walletAddress.toLowerCase();
  log(`Starting for ${walletLower}`);

  try {
    log("Fetching all native and token transactions (no time filter)...");
    const [native, tokens] = await Promise.all([
      fetchAllNativeTransactions(walletAddress, apiKey, {
        delayMs: DELAY_MS,
      }),
      fetchAllTokenTransactions(walletAddress, apiKey, {
        delayMs: DELAY_MS,
      }),
    ]);

    log(`Fetched ${native.length} native, ${tokens.length} token txs`);

    const monthlyData = processIncomingPayouts(
      native,
      tokens,
      walletAddress
    );
    const months = Object.keys(monthlyData).sort();

    if (months.length === 0) {
      log("No incoming payouts >= $10 found; nothing to write.");
      process.exit(0);
    }

    for (const yearMonth of months) {
      const data = monthlyData[yearMonth];
      const transactions = data.transactions.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );
      const summary = data.summary;
      const summaryRounded = {
        totalPayouts: Math.round(summary.totalPayouts),
        payoutCount: summary.payoutCount,
        largestPayout:
          transactions.length > 0
            ? Math.round(Math.max(...transactions.map((t) => t.amount)))
            : 0,
        avgPayout:
          summary.payoutCount > 0
            ? Math.round(summary.totalPayouts / summary.payoutCount)
            : 0,
      };
      const blob = {
        summary: summaryRounded,
        dailyBuckets: buildDailyBuckets(transactions),
        transactions,
      };

      const { error } = await supabase.from("trader_payout_history").upsert(
        {
          wallet_address: walletLower,
          year_month: yearMonth,
          data: blob,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "wallet_address,year_month",
        }
      );

      if (error) {
        logError(`Upsert ${yearMonth} failed:`, error.message);
        throw error;
      }
      log(`Upserted trader_payout_history ${walletLower} / ${yearMonth}`);
    }

    log(`Complete. ${months.length} month(s) written to trader_payout_history.`);
    process.exit(0);
  } catch (err) {
    logError("Error:", err.message);
    if (err.stack) logError(err.stack);
    process.exit(1);
  }
}

main();
