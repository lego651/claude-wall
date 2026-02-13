/**
 * Payout Sync Service
 * 
 * Syncs payout data from Arbiscan to Supabase.
 * Runs every 10 minutes via Vercel cron job.
 * 
 * PP2-004: Sync Service Module
 */

import { createClient } from '@supabase/supabase-js';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'payoutSync' });

// Create Supabase client with service role key (bypasses RLS)
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Token to payment method mapping
const TOKEN_TO_METHOD = {
  'RISEPAY': 'rise',
  'USDC': 'crypto',
  'USDT': 'crypto',
  'ETH': 'crypto',
};

// Supported tokens
const SUPPORTED_TOKENS = ['USDC', 'USDT', 'RISEPAY'];

// Token prices (TODO: fetch from API)
const PRICES = {
  ETH: 2500,
  USDC: 1.00,
  USDT: 1.00,
  RISEPAY: 1.00,
};

/**
 * Process raw Arbiscan data into payout records
 * Exported for unit testing.
 *
 * @param {Array} nativeData - Native ETH transactions
 * @param {Array} tokenData - ERC-20 token transactions
 * @param {Array} sourceAddresses - Firm wallet addresses
 * @param {string} firmId - Firm identifier
 * @returns {Array} Processed payout records ready for Supabase
 */
export function processPayouts(nativeData, tokenData, sourceAddresses, firmId) {
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

/**
 * Sync payouts for a single firm
 * 
 * @param {Object} firm - Firm object with id and addresses
 * @returns {Object} Sync result { firmId, newPayouts, error }
 */
export async function syncFirmPayouts(firm) {
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    const vercelEnv = process.env.VERCEL_ENV || 'unknown';
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'unknown';
    log.error(
      { vercelEnv, vercelUrl, message: 'Missing ARBISCAN_API_KEY - see docs/INNGEST-ENV-VARS.md' },
      'Missing ARBISCAN_API_KEY'
    );
    throw new Error('Missing ARBISCAN_API_KEY environment variable');
  }

  const supabase = createServiceClient();
  const results = { firmId: firm.id, newPayouts: 0, error: null };

  try {
    log.info({ firmId: firm.id, firmName: firm.name, addressCount: firm.addresses.length }, 'Starting sync');

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
        await new Promise(r => setTimeout(r, 500));
      }
    }

    log.info({ firmId: firm.id, nativeCount: allNative.length, tokenCount: allTokens.length }, 'Fetched txs');

    // Process into payout records
    const payouts = processPayouts(allNative, allTokens, firm.addresses, firm.id);
    log.info({ firmId: firm.id, payoutCount: payouts.length }, 'Processed payouts (last 24h)');

    if (payouts.length === 0) {
      log.info({ firmId: firm.id }, 'No new payouts');
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

    await updateFirmLastPayout(firm.id, latestPayout);

    log.info({ firmId: firm.id, payoutCount: payouts.length }, 'Successfully synced payouts');

  } catch (error) {
    log.error({ firmId: firm.id, firmName: firm.name, error: error.message, stack: error.stack }, 'Error syncing');
    results.error = error.message;
  }

  return results;
}

/**
 * Update firm's last payout metadata
 * 
 * @param {string} firmId - Firm identifier
 * @param {Object} latestPayout - Most recent payout record
 */
export async function updateFirmLastPayout(firmId, latestPayout) {
  const supabase = createServiceClient();

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

/**
 * Cleanup old payouts (older than specified hours)
 * 
 * @param {number} hoursToKeep - Hours of data to retain (default: 24)
 * @returns {Object} { deleted, error }
 */
export async function cleanupOldPayouts(hoursToKeep = 24) {
  const supabase = createServiceClient();
  const cutoffDate = new Date(Date.now() - (hoursToKeep * 60 * 60 * 1000)).toISOString();

  log.info({ cutoffDate }, 'Cleaning up old payouts');

  const { error, count } = await supabase
    .from('recent_payouts')
    .delete()
    .lt('timestamp', cutoffDate)
    .select('*', { count: 'exact', head: true });

  if (error) {
    log.error({ error: error.message }, 'Cleanup failed');
    return { deleted: 0, error: error.message };
  }

  log.info({ deleted: count || 0 }, 'Cleaned up old payouts');
  return { deleted: count || 0, error: null };
}

/**
 * Sync all firms
 * Main entry point for the cron job
 * 
 * @returns {Object} Sync summary { firms, totalPayouts, errors, duration }
 */
export async function syncAllFirms() {
  const startTime = Date.now();
  const supabase = createServiceClient();

  log.info('Starting full sync');

  // Fetch all firms from Supabase
  const { data: firms, error: fetchError } = await supabase
    .from('firms')
    .select('id, name, addresses');

  if (fetchError) {
    throw new Error(`Failed to fetch firms: ${fetchError.message}`);
  }

  if (!firms || firms.length === 0) {
    log.info('No firms found in database');
    return { firms: 0, totalPayouts: 0, errors: [], duration: 0 };
  }

  log.info({ firmCount: firms.length }, 'Found firms to sync');

  // Sync each firm
  const results = [];
  for (const firm of firms) {
    const result = await syncFirmPayouts(firm);
    results.push(result);

    // Small delay between firms to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  // Cleanup old payouts
  await cleanupOldPayouts(24);

  // Compile summary
  const summary = {
    firms: firms.length,
    totalPayouts: results.reduce((sum, r) => sum + r.newPayouts, 0),
    errors: results.filter(r => r.error).map(r => ({ firmId: r.firmId, error: r.error })),
    duration: Date.now() - startTime,
  };

  log.info(
    { totalPayouts: summary.totalPayouts, duration: summary.duration, errorCount: summary.errors.length },
    'Sync complete'
  );
  if (summary.errors.length > 0) {
    log.warn({ errors: summary.errors }, 'Sync had errors');
  }

  return summary;
}
