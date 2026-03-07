#!/usr/bin/env node
/**
 * Update Trader Monthly Payout History (Daily)
 *
 * Fetches the current month's incoming payouts for every trader wallet
 * from Arbiscan and upserts into Supabase trader_history_payouts.
 *
 * Designed to run daily via GitHub Actions (sync-trader-payouts-historical.yml).
 * Only updates the current month — full historical backfill is handled by
 * backfill-trader-history.js.
 *
 * Usage:
 *   npx tsx scripts/update-trader-monthly-json.js
 *   npx tsx scripts/update-trader-monthly-json.js --wallet 0xABC...  (single wallet)
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fetchNativeTransactions, fetchTokenTransactions } from "@/lib/arbiscan";

config();

const PRICES = { ETH: 2500, USDC: 1.0, USDT: 1.0, RISEPAY: 1.0 };
const SUPPORTED_TOKENS = ["USDC", "USDT", "RISEPAY"];
const TOKEN_TO_METHOD = { RISEPAY: "rise", USDC: "crypto", USDT: "crypto", ETH: "crypto" };
const MIN_PAYOUT_USD = 10;
const DELAY_MS = 600;

function log(msg, ...args) { console.log(`[UpdateTraderMonthly] ${msg}`, ...args); }
function logError(msg, ...args) { console.error(`[UpdateTraderMonthly] ${msg}`, ...args); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function getCurrentYearMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Process incoming payouts for a wallet, filtered to a specific year-month (UTC).
 */
function processIncomingForMonth(nativeData, tokenData, walletAddress, yearMonth) {
  const walletLower = walletAddress.toLowerCase();
  const transactions = [];

  function addTx(tx, amountUSD, paymentMethod) {
    if (amountUSD < MIN_PAYOUT_USD) return;
    const date = new Date(parseInt(tx.timeStamp, 10) * 1000);
    const txMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (txMonth !== yearMonth) return;
    transactions.push({
      tx_hash: tx.hash,
      wallet_address: walletLower,
      amount: amountUSD,
      payment_method: paymentMethod,
      timestamp: date.toISOString(),
      from_address: tx.from,
      to_address: tx.to,
    });
  }

  (nativeData || []).forEach((tx) => {
    if (!tx.to || tx.to.toLowerCase() !== walletLower) return;
    const amountUSD = (parseFloat(tx.value) / 1e18) * PRICES.ETH;
    addTx(tx, amountUSD, "crypto");
  });

  (tokenData || []).forEach((tx) => {
    if (!tx.to || tx.to.toLowerCase() !== walletLower) return;
    if (!SUPPORTED_TOKENS.includes((tx.tokenSymbol || "").toUpperCase())) return;
    const decimals = parseInt(tx.tokenDecimal, 10) || 18;
    const token = tx.tokenSymbol.toUpperCase();
    const amountUSD = (parseFloat(tx.value) / Math.pow(10, decimals)) * (PRICES[token] ?? 1);
    addTx(tx, amountUSD, TOKEN_TO_METHOD[token] || "crypto");
  });

  // Deduplicate by tx_hash
  return Array.from(new Map(transactions.map((t) => [t.tx_hash, t])).values()).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
}

function buildDailyBuckets(transactions) {
  const byDate = new Map();
  for (const t of transactions) {
    const date = t.timestamp.split("T")[0];
    if (!byDate.has(date)) byDate.set(date, { date, total: 0, rise: 0, crypto: 0, wire: 0 });
    const b = byDate.get(date);
    b.total += t.amount;
    b[t.payment_method] = (b[t.payment_method] || 0) + t.amount;
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildBlob(transactions) {
  const amounts = transactions.map((t) => t.amount);
  const total = amounts.reduce((s, a) => s + a, 0);
  return {
    summary: {
      totalPayouts: Math.round(total),
      payoutCount: transactions.length,
      largestPayout: amounts.length > 0 ? Math.round(Math.max(...amounts)) : 0,
      avgPayout: amounts.length > 0 ? Math.round(total / amounts.length) : 0,
    },
    dailyBuckets: buildDailyBuckets(transactions),
    transactions,
  };
}

async function updateWallet(walletAddress, apiKey, supabase, yearMonth) {
  const walletLower = walletAddress.toLowerCase();

  const [native, tokens] = await Promise.all([
    fetchNativeTransactions(walletAddress, apiKey).catch(() => []),
    fetchTokenTransactions(walletAddress, apiKey).catch(() => []),
  ]);

  const transactions = processIncomingForMonth(native, tokens, walletLower, yearMonth);

  if (transactions.length === 0) {
    return { wallet: walletLower, payouts: 0, changed: false };
  }

  // Check existing row to detect changes
  const { data: existing } = await supabase
    .from("trader_history_payouts")
    .select("data")
    .eq("wallet_address", walletLower)
    .eq("year_month", yearMonth)
    .maybeSingle();

  const existingCount = existing?.data?.summary?.payoutCount ?? 0;
  if (existingCount === transactions.length) {
    return { wallet: walletLower, payouts: transactions.length, changed: false };
  }

  const blob = buildBlob(transactions);
  const { error } = await supabase.from("trader_history_payouts").upsert(
    { wallet_address: walletLower, year_month: yearMonth, data: blob, updated_at: new Date().toISOString() },
    { onConflict: "wallet_address,year_month" }
  );

  if (error) throw new Error(`Upsert failed for ${walletLower}: ${error.message}`);

  return { wallet: walletLower, payouts: transactions.length, changed: true, newPayouts: transactions.length - existingCount };
}

async function main() {
  const args = process.argv.slice(2);
  const walletArg = args.includes("--wallet") ? args[args.indexOf("--wallet") + 1] : null;

  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) { logError("Missing ARBISCAN_API_KEY"); process.exit(1); }

  const supabase = createServiceClient();
  const yearMonth = getCurrentYearMonth();

  log(`Starting daily update for ${yearMonth}`);

  let wallets;
  if (walletArg) {
    if (!walletArg.match(/^0x[a-fA-F0-9]{40}$/)) { logError("Invalid wallet address"); process.exit(1); }
    wallets = [walletArg];
    log(`Single wallet mode: ${walletArg}`);
  } else {
    const { data: profiles, error } = await supabase
      .from("user_profiles")
      .select("wallet_address")
      .not("wallet_address", "is", null);
    if (error) { logError("Failed to fetch wallets:", error.message); process.exit(1); }
    wallets = (profiles || []).map((p) => p.wallet_address);
    log(`Found ${wallets.length} trader wallet(s)`);
  }

  const results = [];
  for (const wallet of wallets) {
    try {
      const result = await updateWallet(wallet, apiKey, supabase, yearMonth);
      results.push(result);
      if (result.changed) {
        log(`✅ ${wallet.slice(0, 10)}... +${result.newPayouts} new payouts (${result.payouts} total)`);
      } else {
        log(`⏸  ${wallet.slice(0, 10)}... no changes (${result.payouts} payouts)`);
      }
    } catch (err) {
      logError(`❌ ${wallet}:`, err.message);
      results.push({ wallet, error: err.message });
    }
    if (wallets.length > 1) await sleep(DELAY_MS);
  }

  const changed = results.filter((r) => r.changed).length;
  const errors = results.filter((r) => r.error).length;
  const newPayouts = results.filter((r) => r.changed).reduce((s, r) => s + r.newPayouts, 0);

  log(`\nDone. ${changed} wallet(s) updated, ${newPayouts} new payout(s), ${errors} error(s).`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  logError("Fatal:", err.message);
  process.exit(1);
});
