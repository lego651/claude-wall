import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    const { display_name, bio, handle, twitter, instagram, youtube, wallet_address } = body;

    // Validate and normalize handle if provided
    let normalizedHandle = null;
    if (handle && handle.trim() !== "") {
      normalizedHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (normalizedHandle.length < 3) {
        return NextResponse.json(
          { error: "Handle must be at least 3 characters long" },
          { status: 400 }
        );
      }
      // Handle must be unique (excluding current user)
      const { data: existingHandleProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("handle", normalizedHandle)
        .neq("id", user.id)
        .maybeSingle();
      if (existingHandleProfile) {
        return NextResponse.json(
          { error: "This handle is already taken. Please choose another." },
          { status: 400 }
        );
      }
    }

    // Get existing profile to check if wallet is being added for first time
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("wallet_address, backfilled_at")
      .eq("id", user.id)
      .single();

    // Validate wallet address format if provided (allow null for deletion)
    let isNewWallet = false;
    if (wallet_address !== null && wallet_address !== undefined && wallet_address !== "") {
      const trimmedAddress = wallet_address.trim().toLowerCase();
      const ethereumPattern = /^0x[a-fA-F0-9]{40}$/;
      const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

      if (!ethereumPattern.test(trimmedAddress) && !solanaPattern.test(trimmedAddress)) {
        return NextResponse.json(
          { error: "Invalid wallet address format" },
          { status: 400 }
        );
      }

      // Check if this is a new wallet (different from existing or no existing wallet)
      if (!existingProfile?.wallet_address ||
          existingProfile.wallet_address.toLowerCase() !== trimmedAddress) {
        isNewWallet = true;
        // New wallet: ensure it's not a prop firm address and not already used by another user
        const path = require("path");
        const fs = require("fs");
        const propFirmsPath = path.join(process.cwd(), "data", "propfirms.json");
        const propFirmsData = JSON.parse(fs.readFileSync(propFirmsPath, "utf8"));
        const allPropFirmAddresses = propFirmsData.firms.flatMap((firm) =>
          firm.addresses.map((addr) => addr.toLowerCase())
        );
        if (allPropFirmAddresses.includes(trimmedAddress)) {
          return NextResponse.json(
            { error: "This wallet address belongs to a prop firm and cannot be linked." },
            { status: 400 }
          );
        }
        const { data: otherProfileWithWallet } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("wallet_address", trimmedAddress)
          .neq("id", user.id)
          .maybeSingle();
        if (otherProfileWithWallet) {
          return NextResponse.json(
            { error: "This wallet address is already linked to another account." },
            { status: 400 }
          );
        }
        console.log(`[Profile API] New wallet detected for user ${user.id}: ${trimmedAddress}`);
      }
    }

    // Prepare profile data
    const profileData = {
      id: user.id,
      email: user.email,
      display_name: display_name || null,
      bio: bio || null,
      handle: normalizedHandle,
      twitter: twitter || null,
      instagram: instagram || null,
      youtube: youtube || null,
      updated_at: new Date().toISOString(),
    };

    // Handle wallet_address: allow null for deletion, or validate and normalize if provided
    if (wallet_address === null || wallet_address === undefined || wallet_address === "") {
      profileData.wallet_address = null;
    } else {
      profileData.wallet_address = wallet_address.trim().toLowerCase();
    }

    // Upsert profile data
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(profileData, {
        onConflict: "id",
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving profile:", error);
      return NextResponse.json(
        { error: "Failed to save profile" },
        { status: 500 }
      );
    }

    // Trigger backfill if new wallet was added
    let backfillTriggered = false;
    if (isNewWallet && profileData.wallet_address) {
      console.log(`[Profile API] Triggering backfill for new wallet: ${profileData.wallet_address}`);

      // Option 1: Call backfill API endpoint (non-blocking, user experience)
      // This allows the profile save to complete immediately
      // The backfill runs asynchronously
      try {
        // Use internal fetch to trigger backfill
        // Note: In production, consider using a job queue (Inngest, BullMQ)
        const backfillUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/backfill-trader`;

        // Fire and forget - don't wait for response
        fetch(backfillUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pass through auth token for verification
            'Cookie': req.headers.get('cookie') || '',
          },
          body: JSON.stringify({ wallet_address: profileData.wallet_address }),
        }).catch(err => {
          console.error('[Profile API] Backfill trigger failed:', err.message);
        });

        backfillTriggered = true;
        console.log('[Profile API] ✅ Backfill job triggered');
      } catch (err) {
        console.error('[Profile API] Failed to trigger backfill:', err.message);
      }
    }

    return NextResponse.json({
      data,
      success: true,
      backfill_triggered: backfillTriggered,
      message: backfillTriggered
        ? "Profile saved! Your transaction history is being synced. This may take a few minutes."
        : undefined
    });
  } catch (error) {
    console.error("Error in profile API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error
      console.error("Error loading profile:", error);
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || null });
  } catch (error) {
    console.error("Error in profile API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
