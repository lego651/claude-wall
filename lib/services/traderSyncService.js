/**
 * Trader Sync Service
 * 
 * Syncs trader transaction data from Arbiscan to Supabase.
 * Runs every 30 minutes via GitHub Actions cron job.
 * 
 * Similar to payoutSyncService but for individual trader wallets
 */

import { createClient } from '@supabase/supabase-js';
import { fetchNativeTransactions, fetchTokenTransactions } from '../arbiscan.js';
import { processTransactions, calculateStats } from '../transactionProcessor.js';
import { getAllTraderTransactions } from './traderDataLoader.js';

// Create Supabase client with service role key (bypasses RLS)
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Sync transaction data for a single trader wallet
 * 
 * @param {string} walletAddress - Trader wallet address
 * @param {string} profileId - Optional profile ID if linked to a user
 * @returns {Object} Sync result { walletAddress, success, error, stats }
 */
export async function syncTraderWallet(walletAddress, profileId = null) {
  const apiKey = process.env.ARBISCAN_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ARBISCAN_API_KEY environment variable');
  }

  const supabase = createServiceClient();
  const result = { 
    walletAddress, 
    profileId,
    success: false, 
    error: null,
    stats: null
  };

  try {
    console.log(`[TraderSync] Starting sync for wallet: ${walletAddress}`);

    // Fetch transactions from Arbiscan (only last 30 days for efficiency)
    // Historical data is stored in JSON files, so we only need recent transactions
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    
    const [nativeData, tokenData] = await Promise.all([
      fetchNativeTransactions(walletAddress, apiKey).catch((err) => {
        console.warn(`[TraderSync] Failed to fetch native txs for ${walletAddress}:`, err.message);
        return [];
      }),
      fetchTokenTransactions(walletAddress, apiKey).catch((err) => {
        console.warn(`[TraderSync] Failed to fetch token txs for ${walletAddress}:`, err.message);
        return [];
      }),
    ]);

    // Process transactions (filter to last 30 days only for efficiency)
    // Historical data is stored in JSON files, so we only sync recent transactions
    const allTransactions = processTransactions(nativeData || [], tokenData || [], walletAddress);
    const recentTransactions = allTransactions.filter(tx => tx.timestamp >= thirtyDaysAgo);
    
    // Get existing record to preserve historical totals
    const { data: existingRecord } = await supabase
      .from('trader_records')
      .select('total_payout_usd, payout_count, first_payout_at, last_payout_at, last_payout_tx_hash')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    // Try to get historical total from JSON files (more accurate)
    // JSON files are updated daily, so they contain data up to yesterday
    // We'll use JSON for historical, and recent transactions for today/last 30 days
    let historicalTotal = 0;
    let historicalCount = 0;
    let jsonTxHashes = new Set();
    let jsonTransactions = [];
    
    try {
      jsonTransactions = await getAllTraderTransactions(walletAddress.toLowerCase(), null, supabase);
      if (jsonTransactions.length > 0) {
        // Calculate total from JSON files (all historical data)
        historicalTotal = jsonTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        historicalCount = jsonTransactions.length;
        // Track transaction hashes to avoid double-counting
        jsonTransactions.forEach(tx => jsonTxHashes.add(tx.tx_hash.toLowerCase()));
      }
    } catch (err) {
      console.warn(`[TraderSync] Could not load JSON files for ${walletAddress}:`, err.message);
    }
    
    // Filter out transactions that are already in JSON files (to avoid double-counting)
    const newRecentTransactions = recentTransactions.filter(
      tx => !jsonTxHashes.has((tx.txHash || tx.hash || '').toLowerCase())
    );
    
    // Calculate stats from new recent transactions only (not in JSON yet)
    const recentStats = calculateStats(newRecentTransactions);
    
    // Determine if we have JSON files or existing record
    const hasJsonData = historicalTotal > 0 || jsonTransactions.length > 0;
    const hasExistingRecord = existingRecord && existingRecord.total_payout_usd;
    
    // Calculate totals based on available data sources
    let totalPayoutUSD = 0;
    let totalPayoutCount = 0;
    let last30DaysPayout = 0;
    
    if (hasJsonData) {
      // We have JSON files: historical (from JSON) + new recent (not in JSON yet)
      totalPayoutUSD = historicalTotal + recentStats.totalPayoutUSD;
      totalPayoutCount = historicalCount + newRecentTransactions.length;
      
      // Calculate last 30 days: from JSON (last 30d) + new recent transactions
      const last30DaysFromJson = jsonTransactions
        .filter(tx => {
          const txDate = new Date(tx.timestamp);
          const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return txDate >= cutoff;
        })
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      
      last30DaysPayout = last30DaysFromJson + recentStats.totalPayoutUSD;
      
      console.log(`[TraderSync] Using JSON data: ${historicalCount} historical + ${newRecentTransactions.length} new recent transactions`);
    } else if (hasExistingRecord) {
      // No JSON files, but we have existing record: preserve historical total
      totalPayoutUSD = parseFloat(existingRecord.total_payout_usd) || 0;
      totalPayoutCount = existingRecord.payout_count || 0;
      
      // Calculate last 30 days from recent transactions only
      last30DaysPayout = recentStats.totalPayoutUSD;
      
      console.log(`[TraderSync] Using existing record: $${totalPayoutUSD.toLocaleString()} total`);
    } else {
      // First sync - no JSON files, no existing record: calculate from ALL transactions
      const allStats = calculateStats(allTransactions);
      totalPayoutUSD = allStats.totalPayoutUSD || 0;
      totalPayoutCount = allTransactions.length;
      last30DaysPayout = allStats.last30DaysPayoutUSD || 0;
      
      console.log(`[TraderSync] First sync: calculated from ${allTransactions.length} total transactions`);
    }
    
    const stats = {
      totalPayoutUSD,
      avgPayoutUSD: recentStats.avgPayoutUSD || 0,
    };

    // Find first and last payout
    // Priority: JSON files (historical) > all transactions (first sync) > recent transactions
    let firstPayout = null;
    let lastPayout = null;
    
    if (jsonTransactions && jsonTransactions.length > 0) {
      // Use JSON for first payout (oldest)
      const sortedJsonOldest = jsonTransactions.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      firstPayout = sortedJsonOldest[0];
      
      // Use JSON for last payout if no new transactions
      if (newRecentTransactions.length === 0) {
        const sortedJsonNewest = jsonTransactions.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        lastPayout = sortedJsonNewest[0];
      }
    }
    
    // Use all transactions for first sync (when no JSON files)
    if (!hasJsonData && allTransactions.length > 0) {
      const sortedAllOldest = allTransactions.sort((a, b) => a.timestamp - b.timestamp);
      firstPayout = {
        timestamp: new Date(sortedAllOldest[0].timestamp * 1000).toISOString(),
        tx_hash: sortedAllOldest[0].txHash,
      };
      
      const sortedAllNewest = allTransactions.sort((a, b) => b.timestamp - a.timestamp);
      lastPayout = {
        timestamp: new Date(sortedAllNewest[0].timestamp * 1000).toISOString(),
        tx_hash: sortedAllNewest[0].txHash,
      };
    }
    
    // Use new recent transactions for last payout (most up-to-date)
    if (newRecentTransactions.length > 0) {
      const sortedRecentNewest = newRecentTransactions.sort((a, b) => b.timestamp - a.timestamp);
      lastPayout = {
        timestamp: new Date(sortedRecentNewest[0].timestamp * 1000).toISOString(),
        tx_hash: sortedRecentNewest[0].txHash,
      };
      
      // Update first if we don't have one from JSON
      if (!firstPayout) {
        const sortedRecentOldest = newRecentTransactions.sort((a, b) => a.timestamp - b.timestamp);
        firstPayout = {
          timestamp: new Date(sortedRecentOldest[0].timestamp * 1000).toISOString(),
          tx_hash: sortedRecentOldest[0].txHash,
        };
      }
    }
    

    // Prepare record data
    // total_payout_usd combines: historical (from JSON files) + recent (last 30 days from Arbiscan)
    const recordData = {
      wallet_address: walletAddress.toLowerCase(),
      profile_id: profileId,
      total_payout_usd: stats.totalPayoutUSD || 0,
      last_30_days_payout_usd: last30DaysPayout,
      avg_payout_usd: stats.avgPayoutUSD || 0,
      payout_count: totalPayoutCount,
      first_payout_at: existingRecord?.first_payout_at || (firstPayout?.timestamp || null),
      last_payout_at: lastPayout?.timestamp || existingRecord?.last_payout_at || null,
      last_payout_tx_hash: lastPayout?.tx_hash || lastPayout?.txHash || lastPayout?.hash || existingRecord?.last_payout_tx_hash || null,
      last_synced_at: new Date().toISOString(),
      sync_error: null,
      updated_at: new Date().toISOString(),
    };

    // Upsert to trader_records
    const { error: upsertError } = await supabase
      .from('trader_records')
      .upsert(recordData, { 
        onConflict: 'wallet_address',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      throw new Error(`Upsert failed: ${upsertError.message}`);
    }

    result.success = true;
    result.stats = {
      totalPayoutUSD: recordData.total_payout_usd,
      last30DaysPayoutUSD: recordData.last_30_days_payout_usd,
      avgPayoutUSD: recordData.avg_payout_usd,
      payoutCount: recordData.payout_count,
    };

    console.log(`[TraderSync] Successfully synced ${walletAddress}: $${recordData.total_payout_usd.toLocaleString()} total`);

  } catch (error) {
    console.error(`[TraderSync] Error syncing ${walletAddress}:`, error);
    result.error = error.message;

    // Update record with error (don't fail completely)
    try {
      await supabase
        .from('trader_records')
        .upsert({
          wallet_address: walletAddress.toLowerCase(),
          profile_id: profileId,
          last_synced_at: new Date().toISOString(),
          sync_error: error.message,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: 'wallet_address',
          ignoreDuplicates: false 
        });
    } catch (updateError) {
      console.error(`[TraderSync] Failed to update error status:`, updateError);
    }
  }

  return result;
}

/**
 * Sync all trader wallets from profiles table
 * 
 * @returns {Object} Sync summary { wallets, successful, errors, duration }
 */
export async function syncAllTraders() {
  const startTime = Date.now();
  const supabase = createServiceClient();

  console.log('[TraderSync] Starting full sync...');

  // Fetch all profiles with wallet addresses
  const { data: profiles, error: fetchError } = await supabase
    .from('profiles')
    .select('id, wallet_address')
    .not('wallet_address', 'is', null);

  if (fetchError) {
    throw new Error(`Failed to fetch profiles: ${fetchError.message}`);
  }

  if (!profiles || profiles.length === 0) {
    console.log('[TraderSync] No trader wallets found');
    return { wallets: 0, successful: 0, errors: [], duration: 0 };
  }

  console.log(`[TraderSync] Found ${profiles.length} trader wallets to sync`);

  // Sync each wallet (with rate limiting)
  const results = [];
  for (const profile of profiles) {
    const result = await syncTraderWallet(profile.wallet_address, profile.id);
    results.push(result);

    // Rate limit: wait 500ms between wallets (Arbiscan allows 5 calls/sec)
    if (profiles.length > 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Compile summary
  const successful = results.filter(r => r.success).length;
  const errors = results.filter(r => !r.success).map(r => ({
    walletAddress: r.walletAddress,
    error: r.error,
  }));

  const summary = {
    wallets: profiles.length,
    successful,
    errors,
    duration: Date.now() - startTime,
  };

  console.log(`[TraderSync] Complete! ${successful}/${profiles.length} wallets synced in ${summary.duration}ms`);
  if (errors.length > 0) {
    console.log(`[TraderSync] Errors:`, errors);
  }

  return summary;
}

/**
 * Cleanup old trader records (wallets that no longer have profiles)
 * 
 * @param {number} daysToKeep - Days to keep orphaned records (default: 90)
 * @returns {Object} { deleted, error }
 */
export async function cleanupOrphanedRecords(daysToKeep = 90) {
  const supabase = createServiceClient();
  const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)).toISOString();

  console.log(`[TraderSync] Cleaning up orphaned records older than ${cutoffDate}`);

  // Delete records that:
  // 1. Have no profile_id (orphaned)
  // 2. Haven't been synced recently (stale)
  // 3. Are older than cutoff date
  const { error, count } = await supabase
    .from('trader_records')
    .delete()
    .is('profile_id', null)
    .lt('last_synced_at', cutoffDate)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[TraderSync] Cleanup failed:', error);
    return { deleted: 0, error: error.message };
  }

  console.log(`[TraderSync] Cleaned up ${count || 0} orphaned records`);
  return { deleted: count || 0, error: null };
}
