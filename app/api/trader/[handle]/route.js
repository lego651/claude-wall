import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAllTraderTransactions } from "@/lib/services/traderDataLoader";
import { calculateStats } from "@/lib/transactionProcessor";

/**
 * Trader API Route
 * 
 * GET /api/trader/[handle]
 * 
 * Returns a single trader profile by handle with their cached transaction statistics
 * Uses JSON files and trader_records table to avoid Arbiscan API calls
 * Uses anon key for public access (relies on RLS policy)
 */
export async function GET(request, { params }) {
  try {
    const { handle } = await params;
    
    if (!handle) {
      return NextResponse.json(
        { error: "Handle parameter is required" },
        { status: 400 }
      );
    }

    // Use anon client for public access (RLS will handle permissions)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Fetch profile by handle (case-insensitive)
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(`
        id,
        display_name,
        handle,
        wallet_address,
        bio,
        twitter,
        instagram,
        youtube,
        created_at,
        trader_records (
          total_payout_usd,
          last_30_days_payout_usd,
          avg_payout_usd,
          payout_count,
          last_synced_at
        )
      `)
      .ilike("handle", handle.toLowerCase())
      .not("wallet_address", "is", null)
      .not("display_name", "is", null)
      .limit(1);

    if (error) {
      console.error("Error fetching trader:", error);
      return NextResponse.json(
        { error: "Failed to fetch trader" },
        { status: 500 }
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        { error: "Trader not found" },
        { status: 404 }
      );
    }

    const profile = profiles[0];
    const record = profile.trader_records?.[0] || null;
    const walletAddress = profile.wallet_address.toLowerCase();

    // Build trader object with stats from trader_records OR JSON files
    let trader = {
      id: profile.id,
      displayName: profile.display_name,
      handle: profile.handle,
      walletAddress: profile.wallet_address,
      bio: profile.bio || null,
      socialLinks: {
        twitter: profile.twitter || null,
        instagram: profile.instagram || null,
        youtube: profile.youtube || null,
      },
      createdAt: profile.created_at,
      totalVerifiedPayout: 0,
      last30DaysPayout: 0,
      avgPayout: 0,
      payoutCount: 0,
      lastSyncedAt: null,
    };

    // If we have cached stats from trader_records, use them
    if (record && record.total_payout_usd > 0) {
      trader.totalVerifiedPayout = parseFloat(record.total_payout_usd) || 0;
      trader.last30DaysPayout = parseFloat(record.last_30_days_payout_usd) || 0;
      trader.avgPayout = parseFloat(record.avg_payout_usd) || 0;
      trader.payoutCount = record.payout_count || 0;
      trader.lastSyncedAt = record.last_synced_at || null;
    } else {
      // Otherwise, try to load from JSON files
      try {
        const jsonTransactions = getAllTraderTransactions(walletAddress);
        
        if (jsonTransactions.length > 0) {
          // Convert JSON transactions to expected format
          const formattedTransactions = jsonTransactions.map(tx => ({
            txHash: tx.tx_hash,
            timestamp: Math.floor(new Date(tx.timestamp).getTime() / 1000),
            from: tx.from_address,
            to: tx.to_address,
            amount: tx.amount,
            token: tx.token,
            amountUSD: tx.amount,
          }));
          
          const stats = calculateStats(formattedTransactions);
          
          // Calculate last 30 days
          const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
          const last30DaysTransactions = formattedTransactions.filter(
            (tx) => tx.timestamp >= thirtyDaysAgo
          );
          const last30DaysPayout = last30DaysTransactions.reduce(
            (sum, tx) => sum + (tx.amountUSD || 0),
            0
          );
          
          trader.totalVerifiedPayout = stats.totalPayoutUSD || 0;
          trader.last30DaysPayout = last30DaysPayout;
          trader.avgPayout = stats.avgPayoutUSD || 0;
          trader.payoutCount = jsonTransactions.length;
        }
      } catch (err) {
        // If JSON files don't exist or error, trader stats remain 0
        console.warn(`[Trader API] Could not load JSON for ${walletAddress}:`, err.message);
      }
    }

    return NextResponse.json({ trader });
  } catch (error) {
    console.error("Error in trader API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
