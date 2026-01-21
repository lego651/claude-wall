/**
 * Transactions API Route
 *
 * GET /api/transactions?address={walletAddress}
 *
 * Fetches and processes blockchain transactions from Arbiscan
 * Returns transaction data with USD values and statistics
 */

import { NextResponse } from 'next/server';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';
import { processTransactions, calculateStats, groupByMonth } from '@/lib/transactionProcessor';

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

    // Check for API key
    const apiKey = process.env.ARBISCAN_API_KEY;
    if (!apiKey) {
      console.error('[API] ARBISCAN_API_KEY not configured');
      return NextResponse.json(
        { error: 'Arbiscan API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[API] Fetching transactions for address: ${address}`);

    // TODO (Phase 1): Add 5-minute caching to reduce Arbiscan API calls
    // TODO (Phase 1): Implement retry logic for failed Arbiscan requests

    // Fetch data from Arbiscan (with error handling - returns empty arrays on failure)
    const [nativeData, tokenData] = await Promise.all([
      fetchNativeTransactions(address, apiKey).catch(() => []),
      fetchTokenTransactions(address, apiKey).catch(() => []),
    ]);

    // Process transactions (handles empty arrays gracefully)
    const transactions = processTransactions(nativeData || [], tokenData || [], address);
    const stats = calculateStats(transactions);
    const monthlyData = groupByMonth(transactions);

    console.log(`[API] Processed ${transactions.length} transactions for ${address}`);

    // Return response (always return 200, even if no transactions found)
    return NextResponse.json({
      address,
      ...stats,
      transactions,
      monthlyData,
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
    });
  }
}
