import { createClient } from "@/libs/supabase/server";
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

    // Validate wallet address format (Ethereum or Solana)
    const ethereumPattern = /^0x[a-fA-F0-9]{40}$/;
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    if (!ethereumPattern.test(wallet_address) && !solanaPattern.test(wallet_address)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Update profile with wallet address
    const { data, error } = await supabase
      .from("profiles")
      .update({
        wallet_address: wallet_address,
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
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            wallet_address: wallet_address,
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
