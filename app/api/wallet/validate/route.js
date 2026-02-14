import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Validates a wallet address:
 * 1. Checks if it's already used by another user
 * 2. Checks if it's a prop firm address
 * 3. Validates format (Ethereum or Solana)
 */
export async function POST(req) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body", valid: false },
        { status: 400 }
      );
    }

    const { wallet_address, current_user_id } = body;

    if (!wallet_address) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const trimmedAddress = wallet_address.trim().toLowerCase();

    console.log("🔍 Validating wallet address:", {
      original: wallet_address,
      trimmed: trimmedAddress,
      current_user_id: current_user_id || "none",
    });

    // 1. Validate format (Ethereum or Solana)
    const ethereumPattern = /^0x[a-fA-F0-9]{40}$/;
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    if (!ethereumPattern.test(trimmedAddress) && !solanaPattern.test(trimmedAddress)) {
      return NextResponse.json(
        { 
          error: "Invalid wallet address format",
          valid: false,
          reason: "format"
        },
        { status: 400 }
      );
    }

    // 2. Check if it's a prop firm address
    let allPropFirmAddresses = [];
    try {
      const propFirmsPath = path.join(process.cwd(), "data", "propfirms.json");
      const propFirmsData = JSON.parse(fs.readFileSync(propFirmsPath, "utf8"));
      allPropFirmAddresses = propFirmsData.firms.flatMap(firm =>
        firm.addresses.map(addr => addr.toLowerCase())
      );
    } catch (fileError) {
      console.error("Error reading propfirms.json:", fileError);
      // Continue without prop firm validation if file is missing
    }

    if (allPropFirmAddresses.includes(trimmedAddress)) {
      return NextResponse.json(
        {
          error: "This wallet address belongs to a prop firm and cannot be linked",
          valid: false,
          reason: "prop_firm"
        },
        { status: 400 }
      );
    }

    // 3. Check if it's already used by another user
    // Note: We need to check case-insensitively since wallet addresses might be stored in different cases
    // Use service role client to bypass RLS since we need to check ALL profiles, not just the current user's
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      {
        auth: { persistSession: false }
      }
    );
    
    // First, try exact match (case-sensitive)
    let { data: existingProfile, error: checkError } = await serviceClient
      .from("profiles")
      .select("id, email, wallet_address")
      .eq("wallet_address", trimmedAddress)
      .maybeSingle();

    console.log("First query result (exact match):", {
      found: !!existingProfile,
      profile: existingProfile,
      error: checkError,
    });

    // If no exact match, try case-insensitive search by getting all profiles with wallet addresses
    // and comparing in JavaScript (since Supabase doesn't support case-insensitive text comparison directly)
    if (!existingProfile && !checkError) {
      const { data: allProfiles, error: allProfilesError } = await serviceClient
        .from("profiles")
        .select("id, email, wallet_address")
        .not("wallet_address", "is", null);

      console.log("All profiles with wallets:", {
        count: allProfiles?.length || 0,
        profiles: allProfiles?.map(p => ({
          id: p.id,
          email: p.email,
          wallet: p.wallet_address,
          walletLower: p.wallet_address?.toLowerCase(),
        })) || [],
        error: allProfilesError,
      });

      if (!allProfilesError && allProfiles) {
        // Find case-insensitive match
        existingProfile = allProfiles.find(
          profile => profile.wallet_address && 
          profile.wallet_address.toLowerCase() === trimmedAddress
        ) || null;

        console.log("Case-insensitive search result:", {
          found: !!existingProfile,
          profile: existingProfile,
        });
      }
    }

    if (checkError) {
      console.error("Error checking wallet address:", checkError);
      return NextResponse.json(
        { error: "Failed to validate wallet address" },
        { status: 500 }
      );
    }

    if (existingProfile) {
      // If current_user_id is provided and matches, it's the same user (allowed)
      if (current_user_id && existingProfile.id === current_user_id) {
        return NextResponse.json({
          valid: true,
          message: "Wallet address is valid",
        });
      }

      console.log("❌ Wallet address already in use:", {
        wallet: trimmedAddress,
        existingUserId: existingProfile.id,
        existingEmail: existingProfile.email,
        existingWalletInDB: existingProfile.wallet_address,
        currentUserId: current_user_id || "none",
      });

      return NextResponse.json(
        {
          error: "This wallet address is already linked to another account",
          valid: false,
          reason: "already_used"
        },
        { status: 400 }
      );
    }

    console.log("✅ Wallet address is available:", trimmedAddress);

    // Wallet is valid
    return NextResponse.json({
      valid: true,
      message: "Wallet address is valid and available",
    });
  } catch (error) {
    console.error("Error in wallet validation:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        error: "Internal server error",
        valid: false,
        details: error.message
      },
      { status: 500 }
    );
  }
}
