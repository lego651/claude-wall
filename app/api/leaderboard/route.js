import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAllTraderTransactions } from "@/lib/services/traderDataLoader";
import { calculateStats } from "@/lib/transactionProcessor";

/**
 * Leaderboard API Route
 *
 * GET /api/leaderboard
 *
 * Returns all public profiles with their transaction statistics.
 * Data source priority: trader_records (by wallet) then trader_history_payouts (Supabase JSON).
 * Uses anon key so unauthenticated visitors can load the page.
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Leaderboard] Missing Supabase env vars");
      return NextResponse.json({ traders: [] });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch public profiles (wallet + display_name + handle)
    const { data: profiles, error } = await supabase
      .from("user_profiles")
      .select("id, display_name, handle, wallet_address, created_at")
      .not("wallet_address", "is", null)
      .not("display_name", "is", null)
      .not("handle", "is", null);

    if (error) {
      console.error("Error fetching profiles:", error);
      return NextResponse.json(
        { error: "Failed to fetch profiles" },
        { status: 500 }
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ traders: [] });
    }

    // Only profiles with non-empty handle (used for /traders/[handle] links)
    const validProfiles = profiles.filter(
      (p) => p.handle != null && String(p.handle).trim().length > 0
    );
    if (validProfiles.length === 0) {
      return NextResponse.json({ traders: [] });
    }

    const traders = await Promise.all(
      validProfiles.map(async (profile) => {
        const walletAddress = profile.wallet_address.toLowerCase();

        // Try cached stats from trader_records (keyed by wallet_address)
        const { data: recordRow } = await supabase
          .from("trader_records")
          .select("total_payout_usd, last_30_days_payout_usd, avg_payout_usd, payout_count, last_synced_at")
          .eq("wallet_address", walletAddress)
          .maybeSingle();

        const record = recordRow && Number(recordRow.total_payout_usd) > 0 ? recordRow : null;
        
        // If we have cached stats from trader_records, use them
        if (record && record.total_payout_usd > 0) {
          return {
            id: profile.id,
            displayName: profile.display_name,
            handle: profile.handle,
            walletAddress: profile.wallet_address,
            createdAt: profile.created_at,
            totalVerifiedPayout: parseFloat(record.total_payout_usd) || 0,
            last30DaysPayout: parseFloat(record.last_30_days_payout_usd) || 0,
            avgPayout: parseFloat(record.avg_payout_usd) || 0,
            payoutCount: record.payout_count || 0,
            lastSyncedAt: record.last_synced_at || null,
          };
        }
        
        // Otherwise, try to load from Supabase (trader_history_payouts) or JSON files
        try {
          const jsonTransactions = await getAllTraderTransactions(walletAddress, null, supabase);
          
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
            
            return {
              id: profile.id,
              displayName: profile.display_name,
              handle: profile.handle,
              walletAddress: profile.wallet_address,
              createdAt: profile.created_at,
              totalVerifiedPayout: stats.totalPayoutUSD || 0,
              last30DaysPayout: last30DaysPayout,
              avgPayout: stats.avgPayoutUSD || 0,
              payoutCount: jsonTransactions.length,
              lastSyncedAt: null, // JSON files don't have sync timestamp
            };
          }
        } catch (err) {
          // If JSON files don't exist or error, return with 0 stats
          console.warn(`[Leaderboard] Could not load JSON for ${walletAddress}:`, err.message);
        }
        
        // No data found - return with 0 stats
        return {
          id: profile.id,
          displayName: profile.display_name,
          handle: profile.handle,
          walletAddress: profile.wallet_address,
          createdAt: profile.created_at,
          totalVerifiedPayout: 0,
          last30DaysPayout: 0,
          avgPayout: 0,
          payoutCount: 0,
          lastSyncedAt: null,
        };
      })
    );

    // Filter out traders with no verified payouts and sort
    const filteredTraders = traders
      .filter(t => t.totalVerifiedPayout > 0)
      .sort((a, b) => b.totalVerifiedPayout - a.totalVerifiedPayout);

    return NextResponse.json({ traders: filteredTraders });
  } catch (error) {
    console.error("Error in leaderboard API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
