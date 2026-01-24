import { createClient } from "@/libs/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import config from "@/config";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Try to get wallet from query params (may be stripped by OAuth provider)
  let walletAddress = requestUrl.searchParams.get("wallet");
  const next = requestUrl.searchParams.get("next") ?? config.auth.callbackUrl;

  console.log("🔐 Auth callback received:", {
    hasCode: !!code,
    walletAddress: walletAddress || "none",
    allParams: Object.fromEntries(requestUrl.searchParams.entries()),
    fullUrl: requestUrl.toString(),
  });
  
  // Note: If wallet is not in query params, it should be in sessionStorage on client side
  // But since this is server-side, we can't access sessionStorage here
  // The wallet should be passed through OAuth queryParams or we need to handle it client-side

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    console.log("👤 Session exchange result:", {
      hasSession: !!session,
      userId: session?.user?.id,
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

  // Build redirect URL - include wallet in query if it was provided (for client-side cleanup)
  const redirectUrl = new URL(next, request.url);
  if (walletAddress) {
    redirectUrl.searchParams.set("wallet_linked", "true");
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(redirectUrl);
}
