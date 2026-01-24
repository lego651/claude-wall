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
    const { twitter, instagram, youtube, wallet_address } = body;

    // Validate wallet address format if provided (allow null for deletion)
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
    }

    // Prepare profile data
    const profileData = {
      id: user.id,
      email: user.email,
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
      .from("profiles")
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

    return NextResponse.json({ data, success: true });
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
      .from("profiles")
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
