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
    const { wallet_address } = body;

    if (!wallet_address) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    const trimmedAddress = wallet_address.trim().toLowerCase();

    // Validate wallet address using the validation endpoint logic
    // 1. Check format
    const ethereumPattern = /^0x[a-fA-F0-9]{40}$/;
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    if (!ethereumPattern.test(trimmedAddress) && !solanaPattern.test(trimmedAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // 2. Check if it's a prop firm address
    const fs = require("fs");
    const path = require("path");
    const propFirmsPath = path.join(process.cwd(), "data", "propfirms.json");
    const propFirmsData = JSON.parse(fs.readFileSync(propFirmsPath, "utf8"));
    const allPropFirmAddresses = propFirmsData.firms.flatMap(firm => 
      firm.addresses.map(addr => addr.toLowerCase())
    );

    if (allPropFirmAddresses.includes(trimmedAddress)) {
      return NextResponse.json(
        { error: "This wallet address belongs to a prop firm and cannot be linked" },
        { status: 400 }
      );
    }

    // 3. Check if it's already used by another user
    const { data: existingProfile, error: checkError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("wallet_address", trimmedAddress)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking wallet address:", checkError);
      return NextResponse.json(
        { error: "Failed to validate wallet address" },
        { status: 500 }
      );
    }

    if (existingProfile && existingProfile.id !== user.id) {
      return NextResponse.json(
        { error: "This wallet address is already linked to another account" },
        { status: 400 }
      );
    }

    // Update profile with wallet address (use trimmed lowercase version)
    const { data, error } = await supabase
      .from("user_profiles")
      .update({
        wallet_address: trimmedAddress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error linking wallet:", error);
      
      // If profile doesn't exist, create it
      if (error.code === "PGRST116") {
        const { data: newProfile, error: createError } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            email: user.email,
            wallet_address: trimmedAddress,
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json(
            { error: "Failed to create profile with wallet" },
            { status: 500 }
          );
        }

        return NextResponse.json({ data: newProfile, success: true });
      }

      return NextResponse.json(
        { error: "Failed to link wallet address" },
        { status: 500 }
      );
    }

    console.log("✅ Wallet linked successfully for user:", user.id);
    return NextResponse.json({ data, success: true });
  } catch (error) {
    console.error("Error in link-wallet API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
