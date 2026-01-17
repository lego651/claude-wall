import { NextResponse } from 'next/server';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';
import {
  processOutgoingTransactions,
  calculatePropFirmStats,
  groupByDay,
} from '@/lib/transactionProcessor';

/**
 * GET /api/propfirm-transactions
 *
 * Fetch and process outgoing transactions for prop firm addresses
 *
 * Query params:
 * - addresses: Comma-separated list of wallet addresses
 * - days: Number of days to look back (default: 7)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const addressesParam = searchParams.get('addresses');
    const days = parseInt(searchParams.get('days') || '7');

    // Validate addresses parameter
    if (!addressesParam) {
      return NextResponse.json(
        { error: 'Addresses parameter required' },
        { status: 400 }
      );
    }

    // Parse and clean addresses
    const addresses = addressesParam
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);

    if (addresses.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid address required' },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.ARBISCAN_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Arbiscan API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[PropFirm API] Fetching transactions for ${addresses.length} addresses, last ${days} days`);

    // Fetch transactions for all addresses
    const allNativeData = [];
    const allTokenData = [];

    for (const address of addresses) {
      console.log(`[PropFirm API] Fetching for address: ${address}`);

      const nativeData = await fetchNativeTransactions(address, apiKey);
      const tokenData = await fetchTokenTransactions(address, apiKey);

      allNativeData.push(...nativeData);
      allTokenData.push(...tokenData);
    }

    console.log(`[PropFirm API] Total raw txs: ${allNativeData.length} native, ${allTokenData.length} token`);

    // Process outgoing transactions
    const transactions = processOutgoingTransactions(
      allNativeData,
      allTokenData,
      addresses,
      days
    );

    console.log(`[PropFirm API] Processed ${transactions.length} outgoing transactions`);

    // Calculate statistics
    const stats = calculatePropFirmStats(transactions);

    // Group by day for chart
    const dailyData = groupByDay(transactions, days);

    // Get top 10 largest payouts
    const topPayouts = [...transactions]
      .sort((a, b) => b.amountUSD - a.amountUSD)
      .slice(0, 10);

    // Get latest payouts (last 24 hours)
    const twentyFourHoursAgo = Date.now() / 1000 - (24 * 60 * 60);
    const latestPayouts = transactions.filter(tx => tx.timestamp >= twentyFourHoursAgo);

    console.log(`[PropFirm API] Stats: ${stats.totalPayoutCount} payouts, $${stats.totalPayoutUSD} total`);

    return NextResponse.json({
      addresses,
      days,
      ...stats,
      transactions,
      dailyData,
      topPayouts,
      latestPayouts,
    });
  } catch (error) {
    console.error('[PropFirm API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
