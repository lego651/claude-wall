import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Simple endpoint to create a profile for the current user if it doesn't exist
// This is a one-time fix for existing users
export async function POST(req) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ 
        message: "Profile already exists",
        data: existingProfile 
      });
    }

    // Create profile
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating profile:", error);
      return NextResponse.json(
        { error: "Failed to create profile", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: "Profile created successfully",
      data 
    });
  } catch (error) {
    console.error("Error in create-profile API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
