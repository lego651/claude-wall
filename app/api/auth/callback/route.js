import { createClient } from "@/lib/supabase/server";
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
          .from("user_profiles")
          .select("id, wallet_address, display_name, handle")
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

        // Default display_name and handle from Google/auth (so they are stored in DB, not only in UI)
        const defaultDisplayName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split("@")[0] ||
          null;
        const emailPrefix = session.user.email?.split("@")[0];
        const rawHandle = emailPrefix
          ? emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, "")
          : "";
        const defaultHandle =
          rawHandle.length >= 3
            ? rawHandle
            : rawHandle.length > 0
              ? (rawHandle + "0".repeat(3)).slice(0, 3)
              : null;

        // Prepare profile data
        const profileData = {
          id: session.user.id,
          email: session.user.email,
          display_name: defaultDisplayName,
          handle: defaultHandle,
          updated_at: new Date().toISOString(),
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
            .from("user_profiles")
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
              display_name: newProfile?.display_name || "null",
              handle: newProfile?.handle || "null",
              wallet_address: newProfile?.wallet_address || "null",
            });
            if (walletAddress) {
              console.log("✅ Wallet address linked:", walletAddress);
              // Trigger backfill for new wallet
              triggerBackfill(walletAddress, session.user.id);
            }
          }
        } else {
          // Existing profile: backfill display_name/handle from auth if null, and optionally update wallet
          const updatePayload = { updated_at: new Date().toISOString() };
          if (existingProfile.display_name == null && defaultDisplayName) {
            updatePayload.display_name = defaultDisplayName;
          }
          if (existingProfile.handle == null && defaultHandle) {
            updatePayload.handle = defaultHandle;
          }
          if (walletAddress && !existingProfile.wallet_address) {
            updatePayload.wallet_address = walletAddress;
          }

          if (Object.keys(updatePayload).length > 1) {
            console.log("🔄 Updating existing profile:", Object.keys(updatePayload));
            const { error: updateError } = await serviceClient
              .from("user_profiles")
              .update(updatePayload)
              .eq("id", session.user.id);

            if (updateError) {
              console.error("❌ Error updating profile in callback:", updateError.message);
            } else {
              if (updatePayload.display_name) console.log("✅ Set display_name from auth");
              if (updatePayload.handle) console.log("✅ Set handle from auth");
              if (updatePayload.wallet_address) {
                console.log("✅ Wallet address linked:", updatePayload.wallet_address);
                triggerBackfill(updatePayload.wallet_address, session.user.id);
              }
            }
          } else if (walletAddress && existingProfile.wallet_address) {
            triggerBackfill(walletAddress, session.user.id);
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
 * Mark backfill as successful: set backfilled_at, clear backfill_error
 */
async function updateBackfillSuccess(userId) {
  try {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { persistSession: false } }
    );
    await serviceClient
      .from("user_profiles")
      .update({
        backfilled_at: new Date().toISOString(),
        backfill_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch (err) {
    console.error("[OAuth Backfill] Failed to update backfilled_at:", err);
  }
}

/**
 * Store backfill error in profile for debugging; user can retry from dashboard
 */
async function updateBackfillError(userId, errorMessage) {
  try {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { persistSession: false } }
    );
    await serviceClient
      .from("user_profiles")
      .update({
        backfill_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch (err) {
    console.error("[OAuth Backfill] Failed to update backfill_error:", err);
  }
}

/**
 * Trigger backfill for a newly linked wallet
 * Runs in background, doesn't block the OAuth redirect
 */
async function triggerBackfill(walletAddress, userId) {
  try {
    console.log(`[OAuth Backfill] Triggering backfill for wallet: ${walletAddress}`);

    if (!process.env.ARBISCAN_API_KEY) {
      console.error("[OAuth Backfill] ARBISCAN_API_KEY not found - skipping backfill");
      await updateBackfillError(userId, "Missing ARBISCAN_API_KEY");
      return;
    }

    const scriptPath = "scripts/backfill-trader-history.js";
    const command = `npx tsx ${scriptPath} ${walletAddress}`;

    console.log(`[OAuth Backfill] Executing: ${command}`);

    execPromise(command, {
      timeout: 300000, // 5 minutes max
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })
      .then(async ({ stdout, stderr }) => {
        if (stdout) console.log("[OAuth Backfill] Script output:", stdout);
        if (stderr) console.warn("[OAuth Backfill] Script warnings:", stderr);
        await updateBackfillSuccess(userId);
        console.log(`[OAuth Backfill] ✅ Backfill complete for ${walletAddress}`);
      })
      .catch(async (execError) => {
        console.error("[OAuth Backfill] Script execution error:", execError.message);
        const message = execError.killed
          ? "Timeout: too many transactions"
          : execError.message || String(execError);
        await updateBackfillError(userId, message);
        if (execError.killed) {
          console.error("[OAuth Backfill] Timeout - wallet may have too many transactions");
        }
      });

    console.log("[OAuth Backfill] ✅ Backfill job queued (running in background)");
  } catch (error) {
    console.error("[OAuth Backfill] Unexpected error:", error);
    await updateBackfillError(userId, error?.message || String(error));
  }
}
