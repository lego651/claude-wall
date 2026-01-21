#!/usr/bin/env node

/**
 * Sync Payouts to Supabase
 * 
 * Standalone script for GitHub Actions to sync payout data
 * from Arbiscan to Supabase.
 * 
 * This replaces the Vercel cron job endpoint.
 * 
 * Usage:
 *   node scripts/sync-to-supabase.js
 * 
 * Required environment variables:
 *   - ARBISCAN_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const ARBISCAN_API_BASE = 'https://api.etherscan.io/v2/api';
const ARBITRUM_CHAIN_ID = '42161';

// Token config
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];
const PRICES = { ETH: 2500, USDC: 1.00, USDT: 1.00, RISEPAY: 1.00 };
const TOKEN_TO_METHOD = { RISEPAY: 'rise', USDC: 'crypto', USDT: 'crypto', ETH: 'crypto' };

// ============================================================================
// Supabase Client
// ============================================================================

async function createSupabaseClient() {
  // Dynamic import for ES module
  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// ============================================================================
// Arbiscan API
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function fetchNativeTransactions(address, apiKey) {
  const url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;
  return fetchWithRetry(url);
}

async function fetchTokenTransactions(address, apiKey) {
  const url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;
  return fetchWithRetry(url);
}

// ============================================================================
// Data Processing
// ============================================================================

function processPayouts(nativeData, tokenData, sourceAddresses, firmId) {
  const now = Date.now() / 1000;
  const cutoff24h = now - (24 * 60 * 60);
  const lowerAddresses = sourceAddresses.map(a => a.toLowerCase());

  // Process native ETH (outgoing from firm)
  const nativePayouts = nativeData
    .filter(tx => tx.from && lowerAddresses.includes(tx.from.toLowerCase()))
    .filter(tx => parseInt(tx.timeStamp) >= cutoff24h)
    .map(tx => {
      const amount = parseFloat(tx.value) / 1e18;
      const amountUSD = amount * PRICES.ETH;
      return {
        tx_hash: tx.hash,
        firm_id: firmId,
        amount: amountUSD,
        payment_method: 'crypto',
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
      };
    });

  // Process ERC-20 tokens (outgoing from firm)
  const tokenPayouts = tokenData
    .filter(tx => tx.from && lowerAddresses.includes(tx.from.toLowerCase()))
    .filter(tx => parseInt(tx.timeStamp) >= cutoff24h)
    .filter(tx => SUPPORTED_TOKENS.includes(tx.tokenSymbol?.toUpperCase()))
    .map(tx => {
      const decimals = parseInt(tx.tokenDecimal) || 18;
      const amount = parseFloat(tx.value) / Math.pow(10, decimals);
      const token = tx.tokenSymbol.toUpperCase();
      const amountUSD = amount * (PRICES[token] || 1);
      return {
        tx_hash: tx.hash,
        firm_id: firmId,
        amount: amountUSD,
        payment_method: TOKEN_TO_METHOD[token] || 'crypto',
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        from_address: tx.from,
        to_address: tx.to,
      };
    });

  // Combine, filter spam (<$10), and deduplicate
  const allPayouts = [...nativePayouts, ...tokenPayouts]
    .filter(p => p.amount >= 10);

  // Deduplicate by tx_hash
  const uniquePayouts = Array.from(
    new Map(allPayouts.map(p => [p.tx_hash, p])).values()
  );

  return uniquePayouts;
}

// ============================================================================
// Sync Functions
// ============================================================================

async function syncFirmPayouts(supabase, firm, apiKey) {
  const results = { firmId: firm.id, newPayouts: 0, error: null };

  try {
    console.log(`[Sync] Starting sync for ${firm.name} (${firm.addresses.length} addresses)`);

    // Fetch transactions from all addresses
    let allNative = [];
    let allTokens = [];

    for (const address of firm.addresses) {
      const [native, tokens] = await Promise.all([
        fetchNativeTransactions(address, apiKey),
        fetchTokenTransactions(address, apiKey),
      ]);
      allNative = [...allNative, ...native];
      allTokens = [...allTokens, ...tokens];

      // Rate limit: 5 calls/sec, we made 2, wait 500ms between addresses
      if (firm.addresses.length > 1) {
        await sleep(500);
      }
    }

    console.log(`[Sync] Fetched ${allNative.length} native + ${allTokens.length} token txs`);

    // Process into payout records
    const payouts = processPayouts(allNative, allTokens, firm.addresses, firm.id);
    console.log(`[Sync] Processed ${payouts.length} payouts (last 24h)`);

    if (payouts.length === 0) {
      console.log(`[Sync] No new payouts for ${firm.name}`);
      return results;
    }

    // Upsert payouts to Supabase
    const { error: upsertError } = await supabase
      .from('recent_payouts')
      .upsert(payouts, { onConflict: 'tx_hash' });

    if (upsertError) {
      throw new Error(`Upsert failed: ${upsertError.message}`);
    }

    results.newPayouts = payouts.length;

    // Update firm's last payout info
    const latestPayout = payouts.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    )[0];

    await updateFirmLastPayout(supabase, firm.id, latestPayout);

    console.log(`[Sync] Successfully synced ${payouts.length} payouts for ${firm.name}`);

  } catch (error) {
    console.error(`[Sync] Error syncing ${firm.name}:`, error);
    results.error = error.message;
  }

  return results;
}

async function updateFirmLastPayout(supabase, firmId, latestPayout) {
  // First check if this payout is newer than what's stored
  const { data: firm } = await supabase
    .from('firms')
    .select('last_payout_at')
    .eq('id', firmId)
    .single();

  const existingTimestamp = firm?.last_payout_at ? new Date(firm.last_payout_at) : null;
  const newTimestamp = new Date(latestPayout.timestamp);

  // Only update if this payout is newer
  if (!existingTimestamp || newTimestamp > existingTimestamp) {
    const { error } = await supabase
      .from('firms')
      .update({
        last_payout_at: latestPayout.timestamp,
        last_payout_amount: latestPayout.amount,
        last_payout_tx_hash: latestPayout.tx_hash,
        last_payout_method: latestPayout.payment_method,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', firmId);

    if (error) {
      console.error(`[Sync] Failed to update firm ${firmId}:`, error);
    }
  } else {
    // Just update sync timestamp
    await supabase
      .from('firms')
      .update({
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', firmId);
  }
}

async function cleanupOldPayouts(supabase, hoursToKeep = 24) {
  const cutoffDate = new Date(Date.now() - (hoursToKeep * 60 * 60 * 1000)).toISOString();

  console.log(`[Sync] Cleaning up payouts older than ${cutoffDate}`);

  const { error, count } = await supabase
    .from('recent_payouts')
    .delete()
    .lt('timestamp', cutoffDate)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[Sync] Cleanup failed:', error);
    return { deleted: 0, error: error.message };
  }

  console.log(`[Sync] Cleaned up ${count || 0} old payouts`);
  return { deleted: count || 0, error: null };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = Date.now();
  
  console.log('🚀 Payout Sync Script (Supabase)');
  console.log('================================\n');

  // Validate environment
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    console.error('❌ ARBISCAN_API_KEY not found');
    process.exit(1);
  }

  // Load firms from JSON
  const firmsPath = path.join(process.cwd(), 'data', 'propfirms.json');
  const firmsData = JSON.parse(fs.readFileSync(firmsPath, 'utf8'));
  const firms = firmsData.firms;

  console.log(`Found ${firms.length} firm(s) to sync\n`);

  // Create Supabase client
  const supabase = await createSupabaseClient();

  // Sync each firm
  const results = [];
  for (const firm of firms) {
    const result = await syncFirmPayouts(supabase, firm, apiKey);
    results.push(result);

    // Small delay between firms to avoid rate limits
    await sleep(1000);
  }

  // Cleanup old payouts
  await cleanupOldPayouts(supabase, 24);

  // Summary
  const summary = {
    firms: firms.length,
    totalPayouts: results.reduce((sum, r) => sum + r.newPayouts, 0),
    errors: results.filter(r => r.error).map(r => ({ firmId: r.firmId, error: r.error })),
    duration: Date.now() - startTime,
  };

  console.log('\n================================');
  console.log('📋 Summary\n');
  console.log(`  Firms synced: ${summary.firms}`);
  console.log(`  Total payouts: ${summary.totalPayouts}`);
  console.log(`  Duration: ${summary.duration}ms`);
  
  if (summary.errors.length > 0) {
    console.log(`  Errors: ${JSON.stringify(summary.errors)}`);
    process.exit(1);
  }

  console.log('\n✅ Sync complete!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
