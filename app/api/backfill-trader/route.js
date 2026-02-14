import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * Backfill Trader History API
 *
 * POST /api/backfill-trader
 *
 * Triggers a background job to backfill ALL historical transactions
 * for a trader wallet. This runs the backfill script that:
 * 1. Fetches ALL transactions from Arbiscan
 * 2. Generates JSON files for ALL months
 * 3. Commits changes to git
 *
 * This is designed to run ONCE when a user first adds their wallet.
 *
 * Body: { wallet_address: "0x..." }
 *
 * Authorization: Requires authenticated user
 */
export async function POST(req) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { wallet_address } = body;

    // Validate wallet address
    if (!wallet_address || !wallet_address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Verify this wallet belongs to the authenticated user
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", user.id)
      .single();

    if (!profile || profile.wallet_address?.toLowerCase() !== wallet_address.toLowerCase()) {
      return NextResponse.json(
        { error: "Wallet address does not match your profile" },
        { status: 403 }
      );
    }

    console.log(`[Backfill API] Starting backfill for wallet: ${wallet_address}`);

    // Check if ARBISCAN_API_KEY is available
    if (!process.env.ARBISCAN_API_KEY) {
      console.error('[Backfill API] ARBISCAN_API_KEY not found');
      return NextResponse.json(
        { error: "API configuration error" },
        { status: 500 }
      );
    }

    // Run backfill script in background
    // Note: This executes synchronously in serverless environment
    // For production, consider using a job queue (Inngest, BullMQ, etc.)
    try {
      const scriptPath = 'scripts/backfill-trader-history.js';
      const command = `node ${scriptPath} ${wallet_address}`;

      console.log(`[Backfill API] Executing: ${command}`);

      // Execute with timeout (max 5 minutes for serverless)
      const { stdout, stderr } = await execPromise(command, {
        timeout: 300000, // 5 minutes
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stdout) {
        console.log('[Backfill API] Script output:', stdout);
      }
      if (stderr) {
        console.warn('[Backfill API] Script warnings:', stderr);
      }

      // Update profile to mark backfill as complete
      await supabase
        .from("profiles")
        .update({
          backfilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      console.log(`[Backfill API] ✅ Backfill complete for ${wallet_address}`);

      return NextResponse.json({
        success: true,
        message: "Transaction history backfilled successfully",
        wallet_address,
      });

    } catch (execError) {
      console.error('[Backfill API] Script execution error:', execError);

      // Check if timeout
      if (execError.killed) {
        return NextResponse.json({
          error: "Backfill timeout - wallet may have too many transactions. Contact support.",
          code: "TIMEOUT"
        }, { status: 504 });
      }

      return NextResponse.json({
        error: "Failed to run backfill script",
        details: execError.message,
      }, { status: 500 });
    }

  } catch (error) {
    console.error("[Backfill API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Check backfill status
 *
 * GET /api/backfill-trader
 *
 * Returns whether the authenticated user's wallet has been backfilled.
 * For returning users: if backfilled_at is null but we already have transaction
 * data in Supabase (trader_records or trader_payout_history), we treat them as
 * backfilled and set backfilled_at so the "Syncing" banner is not shown again.
 */
export async function GET(req) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_address, backfilled_at")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({
        backfilled: false,
        has_wallet: false
      });
    }

    // Already marked backfilled — no need to check data
    if (profile.backfilled_at) {
      return NextResponse.json({
        backfilled: true,
        has_wallet: !!profile.wallet_address,
        backfilled_at: profile.backfilled_at,
      });
    }

    // No wallet — not backfilled
    if (!profile.wallet_address?.trim()) {
      return NextResponse.json({
        backfilled: false,
        has_wallet: false,
        backfilled_at: null,
      });
    }

    const walletLower = profile.wallet_address.toLowerCase();

    // Returning user: backfilled_at is null but we may already have data in Supabase.
    // If so, treat as backfilled and set backfilled_at so the syncing banner doesn't show.
    const { data: cachedRecord } = await supabase
      .from("trader_records")
      .select("wallet_address, last_synced_at")
      .eq("wallet_address", walletLower)
      .maybeSingle();

    const hasCachedData = !!cachedRecord?.last_synced_at;

    let hasHistoryData = false;
    if (!hasCachedData) {
      const { data: historyRows } = await supabase
        .from("trader_payout_history")
        .select("year_month")
        .eq("wallet_address", walletLower)
        .limit(1);
      hasHistoryData = Array.isArray(historyRows) && historyRows.length > 0;
    }

    const alreadyHasData = hasCachedData || hasHistoryData;

    if (alreadyHasData) {
      const now = new Date().toISOString();
      await supabase
        .from("profiles")
        .update({ backfilled_at: now, updated_at: now })
        .eq("id", user.id);

      return NextResponse.json({
        backfilled: true,
        has_wallet: true,
        backfilled_at: now,
      });
    }

    return NextResponse.json({
      backfilled: false,
      has_wallet: true,
      backfilled_at: null,
    });

  } catch (error) {
    console.error("[Backfill API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
