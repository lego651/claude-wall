import { createClient } from "@/libs/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exec } from "child_process";
import { promisify } from "util";
import config from "@/config";

const execPromise = promisify(exec);

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? config.auth.callbackUrl;

  // Declare walletAddress outside the if block so it's accessible later
  let walletAddress = null;

  console.log("🔐 Auth callback received:", {
    hasCode: !!code,
    allParams: Object.fromEntries(requestUrl.searchParams.entries()),
    fullUrl: requestUrl.toString(),
  });

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    // Try to get wallet from cookie (set by signin page before OAuth redirect)
    const cookieStore = await cookies();
    walletAddress = cookieStore.get('pending_wallet')?.value || null;

    console.log("👤 Session exchange result:", {
      hasSession: !!session,
      userId: session?.user?.id,
      walletFromCookie: walletAddress || "none",
      sessionError: sessionError?.message,
    });

    // Automatically create profile if it doesn't exist and link wallet if provided
    if (session?.user && !sessionError) {
      try {
        // Use service role client to bypass RLS for initial profile creation
        // This is safe because we're only creating a profile for the authenticated user
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.SUPABASE_SERVICE_ROLE_KEY || "",
          {
            auth: { persistSession: false }
          }
        );

        // Check if profile exists
        const { data: existingProfile, error: profileCheckError } = await serviceClient
          .from("profiles")
          .select("id, wallet_address")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileCheckError) {
          console.error("❌ Error checking profile:", profileCheckError);
        }

        console.log("📋 Profile check result:", {
          exists: !!existingProfile,
          hasWallet: !!existingProfile?.wallet_address,
          walletValue: existingProfile?.wallet_address || "null",
        });

        // Prepare profile data
        const profileData = {
          id: session.user.id,
          email: session.user.email,
        };

        // Add wallet address if provided and not already set
        if (walletAddress && (!existingProfile || !existingProfile.wallet_address)) {
          profileData.wallet_address = walletAddress;
          console.log("💼 Adding wallet address to profile data:", walletAddress);
        }

        // If profile doesn't exist, create it; otherwise update it if wallet is provided
        if (!existingProfile) {
          console.log("🆕 Creating new profile with wallet:", walletAddress || "none");
          const { data: newProfile, error: insertError } = await serviceClient
            .from("profiles")
            .upsert(profileData, {
              onConflict: "id",
            })
            .select()
            .single();

          if (insertError) {
            console.error("❌ Error creating profile in callback:", {
              error: insertError,
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint,
              userId: session.user.id,
              profileData,
            });
          } else {
            console.log("✅ Profile created successfully for user:", session.user.id);
            console.log("📝 Created profile data:", {
              id: newProfile?.id,
              email: newProfile?.email,
              wallet_address: newProfile?.wallet_address || "null",
            });
            if (walletAddress) {
              console.log("✅ Wallet address linked:", walletAddress);
              // Trigger backfill for new wallet
              triggerBackfill(walletAddress, session.user.id);
            }
          }
        } else if (walletAddress) {
          // Update existing profile with wallet address (even if it's already set, we'll update it)
          console.log("🔄 Updating existing profile with wallet:", walletAddress);
          const { data: updatedProfile, error: updateError } = await serviceClient
            .from("profiles")
            .update({ 
              wallet_address: walletAddress,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.user.id)
            .select()
            .single();

          if (updateError) {
            console.error("❌ Error updating profile with wallet address:", {
              error: updateError,
              message: updateError.message,
              code: updateError.code,
              userId: session.user.id,
              walletAddress,
            });
          } else {
            console.log("✅ Wallet address linked to existing profile:", walletAddress);
            console.log("📝 Updated profile data:", {
              id: updatedProfile?.id,
              wallet_address: updatedProfile?.wallet_address || "null",
            });
            // Trigger backfill for new wallet
            triggerBackfill(walletAddress, session.user.id);
          }
        } else {
          console.log("ℹ️ Profile already exists for user:", session.user.id);
          if (existingProfile?.wallet_address) {
            console.log("ℹ️ Profile already has wallet address:", existingProfile.wallet_address);
          }
        }
      } catch (error) {
        console.error("❌ Unexpected error in profile creation:", error);
        console.error("Error stack:", error.stack);
      }
    } else {
      console.error("❌ Session error or no user:", { 
        sessionError: sessionError?.message, 
        hasUser: !!session?.user,
        sessionErrorDetails: sessionError,
      });
    }
  } else {
    console.log("⚠️ No code parameter in callback URL");
  }

  // Clear the pending_wallet cookie
  const cookieStore = await cookies();
  cookieStore.delete('pending_wallet');

  // Build redirect URL
  const redirectUrl = new URL(next, request.url);
  if (walletAddress) {
    redirectUrl.searchParams.set("wallet_linked", "true");
  }

  // URL to redirect to after sign in process completes
  const response = NextResponse.redirect(redirectUrl);

  // Delete the cookie in the response as well
  response.cookies.delete('pending_wallet');

  return response;
}

/**
 * Trigger backfill for a newly linked wallet
 * Runs in background, doesn't block the OAuth redirect
 */
async function triggerBackfill(walletAddress, userId) {
  try {
    console.log(`[OAuth Backfill] Triggering backfill for wallet: ${walletAddress}`);

    // Check if ARBISCAN_API_KEY is available
    if (!process.env.ARBISCAN_API_KEY) {
      console.error('[OAuth Backfill] ARBISCAN_API_KEY not found - skipping backfill');
      return;
    }

    // Run backfill script in background (fire-and-forget)
    const scriptPath = 'scripts/backfill-trader-history.js';
    const command = `node ${scriptPath} ${walletAddress}`;

    console.log(`[OAuth Backfill] Executing: ${command}`);

    // Execute without awaiting (fire-and-forget)
    // This runs in background and doesn't block the OAuth redirect
    execPromise(command, {
      timeout: 300000, // 5 minutes max
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })
      .then(({ stdout, stderr }) => {
        if (stdout) {
          console.log('[OAuth Backfill] Script output:', stdout);
        }
        if (stderr) {
          console.warn('[OAuth Backfill] Script warnings:', stderr);
        }

        // Update profile to mark backfill as complete
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.SUPABASE_SERVICE_ROLE_KEY || "",
          { auth: { persistSession: false } }
        );

        serviceClient
          .from("profiles")
          .update({
            backfilled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .then(() => {
            console.log(`[OAuth Backfill] ✅ Backfill complete for ${walletAddress}`);
          })
          .catch((err) => {
            console.error('[OAuth Backfill] Failed to update backfilled_at:', err);
          });
      })
      .catch((execError) => {
        console.error('[OAuth Backfill] Script execution error:', execError.message);

        // Don't fail the OAuth flow - backfill can be retried later
        if (execError.killed) {
          console.error('[OAuth Backfill] Timeout - wallet may have too many transactions');
        }
      });

    console.log('[OAuth Backfill] ✅ Backfill job queued (running in background)');
  } catch (error) {
    console.error('[OAuth Backfill] Unexpected error:', error);
    // Don't throw - we don't want to break the OAuth flow
  }
}
