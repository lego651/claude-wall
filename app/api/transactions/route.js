/**
 * Transactions API Route
 *
 * GET /api/transactions?address={walletAddress}
 *
 * Fetches transaction data in this priority:
 * 1. Historical JSON files (for transactions older than 30 days)
 * 2. Supabase trader_records cache (for recent stats)
 * 3. Arbiscan API (only if cache is stale or missing)
 * 
 * Returns transaction data with USD values and statistics
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';
import { processTransactions, calculateStats, groupByMonth } from '@/lib/transactionProcessor';
import { getAllTraderTransactions } from '@/lib/services/traderDataLoader';

// Create Supabase client (read-only, uses anon key)
function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    // Validate address parameter
    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Validate address format (basic 0x check)
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    const addressLower = address.toLowerCase();
    const supabase = createSupabaseClient();

    // Step 1: Try to load from Supabase (trader_payout_history) or JSON files (historical data)
    let jsonTransactions = [];
    try {
      jsonTransactions = await getAllTraderTransactions(addressLower, null, supabase);
      console.log(`[API] Loaded ${jsonTransactions.length} transactions for ${address}`);
    } catch (err) {
      console.warn(`[API] Error loading JSON files for ${address}:`, err.message);
    }

    // Step 2: Get cached stats from Supabase
    const { data: cachedRecord } = await supabase
      .from('trader_records')
      .select('*')
      .eq('wallet_address', addressLower)
      .single();

    // Check if cache is fresh (synced within last 30 minutes)
    const cacheIsFresh = cachedRecord && cachedRecord.last_synced_at;
    let cacheAge = null;
    if (cacheIsFresh) {
      cacheAge = Date.now() - new Date(cachedRecord.last_synced_at).getTime();
      const thirtyMinutes = 30 * 60 * 1000;
      if (cacheAge < thirtyMinutes) {
        // Use cached stats + JSON transactions
        console.log(`[API] Using cached stats + JSON files for ${address} (${Math.round(cacheAge / 1000 / 60)}m old)`);
        
        // Convert JSON transactions to expected format
        const formattedTransactions = jsonTransactions.map(tx => ({
          txHash: tx.tx_hash,
          timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
          from: tx.from_address,
          to: tx.to_address,
          amount: tx.amount,
          token: tx.token,
          amountUSD: tx.amount,
          fromShort: `${tx.from_address.slice(0, 6)}...${tx.from_address.slice(-4)}`,
          arbiscanUrl: `https://arbiscan.io/tx/${tx.tx_hash}`,
        }));

        // Calculate monthly data from JSON transactions
        const monthlyData = groupByMonth(formattedTransactions);

        return NextResponse.json({
          address,
          totalPayoutUSD: parseFloat(cachedRecord.total_payout_usd) || 0,
          last30DaysPayoutUSD: parseFloat(cachedRecord.last_30_days_payout_usd) || 0,
          avgPayoutUSD: parseFloat(cachedRecord.avg_payout_usd) || 0,
          transactions: formattedTransactions,
          monthlyData,
          cached: true,
          lastSyncedAt: cachedRecord.last_synced_at,
        });
      }
    }

    // Step 3: Cache is stale or missing - try to use JSON files only (no Arbiscan)
    if (jsonTransactions.length > 0) {
      console.log(`[API] Using JSON files only for ${address} (cache stale/missing, avoiding Arbiscan)`);
      
      // Calculate stats from JSON transactions
      const formattedTransactions = jsonTransactions.map(tx => ({
        txHash: tx.tx_hash,
        timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
        from: tx.from_address,
        to: tx.to_address,
        amount: tx.amount,
        token: tx.token,
        amountUSD: tx.amount,
        fromShort: `${tx.from_address.slice(0, 6)}...${tx.from_address.slice(-4)}`,
        arbiscanUrl: `https://arbiscan.io/tx/${tx.tx_hash}`,
      }));

      const stats = calculateStats(formattedTransactions);
      const monthlyData = groupByMonth(formattedTransactions);

      // Calculate last 30 days
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      const last30DaysTransactions = formattedTransactions.filter(
        (tx) => tx.timestamp >= thirtyDaysAgo
      );
      const last30DaysPayout = last30DaysTransactions.reduce(
        (sum, tx) => sum + (tx.amountUSD || 0),
        0
      );

      return NextResponse.json({
        address,
        totalPayoutUSD: stats.totalPayoutUSD || 0,
        last30DaysPayoutUSD: last30DaysPayout,
        avgPayoutUSD: stats.avgPayoutUSD || 0,
        transactions: formattedTransactions,
        monthlyData,
        cached: true,
        fromJson: true,
      });
    }

    // Step 4: No JSON files and no cache - return empty data (don't call Arbiscan)
    // The sync job should populate trader_records and JSON files
    console.log(`[API] No JSON files or cache found for ${address}, returning empty data (sync job should populate)`);
    
    // Return empty data - don't call Arbiscan to avoid rate limits
    // The sync job (every 30 mins) will populate trader_records and JSON files
    return NextResponse.json({
      address,
      totalPayoutUSD: cachedRecord ? parseFloat(cachedRecord.total_payout_usd) || 0 : 0,
      last30DaysPayoutUSD: cachedRecord ? parseFloat(cachedRecord.last_30_days_payout_usd) || 0 : 0,
      avgPayoutUSD: cachedRecord ? parseFloat(cachedRecord.avg_payout_usd) || 0 : 0,
      transactions: [],
      monthlyData: [],
      cached: false,
      empty: true,
      message: 'No cached data available. Sync job will populate data shortly.',
      lastSyncedAt: cachedRecord?.last_synced_at || null,
    });

  } catch (error) {
    console.error('[API] Error fetching transactions:', error);
    // Return empty data instead of error to prevent page crash
    // The frontend can handle empty data gracefully
    return NextResponse.json({
      address: searchParams.get('address') || '',
      totalPayoutUSD: 0,
      last30DaysPayoutUSD: 0,
      avgPayoutUSD: 0,
      transactions: [],
      monthlyData: [],
      cached: false,
      error: error.message,
    });
  }
}
