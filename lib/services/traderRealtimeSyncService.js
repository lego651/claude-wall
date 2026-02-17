/**
 * Trader Realtime Sync Service
 *
 * Syncs last 24h of incoming payouts per trader wallet from Arbiscan into
 * Supabase recent_trader_payouts. Mirrors payoutSyncService (firms) but for
 * trader wallets. Designed to run every 5 minutes via Inngest.
 */

import { createClient } from "@supabase/supabase-js";
import {
  fetchNativeTransactions,
  fetchTokenTransactions,
} from "@/lib/arbiscan";

const SUPPORTED_TOKENS = ["USDC", "USDT", "RISEPAY"];
const PRICES = { ETH: 2500, USDC: 1.0, USDT: 1.0, RISEPAY: 1.0 };
const TOKEN_TO_METHOD = {
  RISEPAY: "rise",
  USDC: "crypto",
  USDT: "crypto",
  ETH: "crypto",
};

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Process raw Arbiscan data into recent_trader_payouts rows (incoming to wallet, last 24h)
 */
function processTraderPayouts(nativeData, tokenData, walletAddress) {
  const now = Date.now() / 1000;
  const cutoff24h = now - 24 * 60 * 60;
  const walletLower = walletAddress.toLowerCase();

  const nativePayouts = (nativeData || [])
    .filter(
      (tx) =>
        tx.to && tx.to.toLowerCase() === walletLower && parseInt(tx.timeStamp) >= cutoff24h
    )
    .map((tx) => {
      const amount = parseFloat(tx.value) / 1e18;
      const amountUSD = amount * PRICES.ETH;
      return {
        tx_hash: tx.hash,
        wallet_address: walletLower,
        amount: amountUSD,
        payment_method: "crypto",
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
      };
    });

  const tokenPayouts = (tokenData || [])
    .filter(
      (tx) =>
        tx.to &&
        tx.to.toLowerCase() === walletLower &&
        parseInt(tx.timeStamp) >= cutoff24h &&
        SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase())
    )
    .map((tx) => {
      const decimals = parseInt(tx.tokenDecimal) || 18;
      const amount = parseFloat(tx.value) / Math.pow(10, decimals);
      const token = tx.tokenSymbol.toUpperCase();
      const amountUSD = amount * (PRICES[token] || 1);
      return {
        tx_hash: tx.hash,
        wallet_address: walletLower,
        amount: amountUSD,
        payment_method: TOKEN_TO_METHOD[token] || "crypto",
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
      };
    });

  const all = [...nativePayouts, ...tokenPayouts].filter((p) => p.amount >= 10);
  return Array.from(new Map(all.map((p) => [p.tx_hash, p])).values());
}

/**
 * Sync realtime payouts for a single trader wallet (last 24h → recent_trader_payouts)
 */
export async function syncTraderWalletRealtime(walletAddress) {
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ARBISCAN_API_KEY");
  }

  const supabase = createServiceClient();
  const result = { walletAddress: walletAddress.toLowerCase(), newPayouts: 0, error: null };

  try {
    const [native, tokens] = await Promise.all([
      fetchNativeTransactions(walletAddress, apiKey),
      fetchTokenTransactions(walletAddress, apiKey),
    ]);

    const payouts = processTraderPayouts(native, tokens, walletAddress);
    if (payouts.length === 0) {
      return result;
    }

    const { error } = await supabase
      .from("trader_recent_payouts")
      .upsert(payouts, { onConflict: "tx_hash" });

    if (error) throw new Error(`Upsert failed: ${error.message}`);
    result.newPayouts = payouts.length;
  } catch (err) {
    console.error(`[TraderRealtimeSync] ${walletAddress}:`, err);
    result.error = err.message;
  }

  return result;
}

/**
 * Remove rows older than 24 hours from recent_trader_payouts
 */
export async function cleanupOldTraderPayouts(hoursToKeep = 24) {
  const supabase = createServiceClient();
  const cutoff = new Date(
    Date.now() - hoursToKeep * 60 * 60 * 1000
  ).toISOString();

  const { error, count } = await supabase
    .from("trader_recent_payouts")
    .delete()
    .lt("timestamp", cutoff)
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("[TraderRealtimeSync] Cleanup failed:", error);
    return { deleted: 0, error: error.message };
  }
  return { deleted: count ?? 0, error: null };
}

/**
 * Sync all trader wallets (from profiles) into recent_trader_payouts, then cleanup.
 * Entry point for Inngest cron.
 */
export async function syncAllTradersRealtime() {
  const start = Date.now();
  const supabase = createServiceClient();

  const { data: profiles, error: fetchError } = await supabase
    .from("user_profiles")
    .select("id, wallet_address")
    .not("wallet_address", "is", null);

  if (fetchError) {
    throw new Error(`Failed to fetch profiles: ${fetchError.message}`);
  }

  if (!profiles?.length) {
    await cleanupOldTraderPayouts(24);
    return {
      wallets: 0,
      totalPayouts: 0,
      errors: [],
      duration: Date.now() - start,
    };
  }

  const results = [];
  for (const profile of profiles) {
    const r = await syncTraderWalletRealtime(profile.wallet_address);
    results.push(r);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await cleanupOldTraderPayouts(24);

  const summary = {
    wallets: profiles.length,
    totalPayouts: results.reduce((s, r) => s + r.newPayouts, 0),
    errors: results.filter((r) => r.error).map((r) => ({ wallet: r.walletAddress, error: r.error })),
    duration: Date.now() - start,
  };

  return summary;
}
