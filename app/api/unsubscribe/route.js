/**
 * TICKET-015: Unsubscribe from weekly digest via token (link in email).
 * GET /api/unsubscribe?token=xxx → disable email for user, redirect to /user/settings?unsubscribed=1
 * Uses service role so the link works without the user being logged in.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Dynamic import for ESM-only module (unsubscribe-token uses crypto)
async function verifyToken(token) {
  const { verifyUnsubscribeToken } = await import("@/lib/email/unsubscribe-token");
  return verifyUnsubscribeToken(token);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/user/settings?error=missing_token", req.url));
  }

  let userId;
  try {
    userId = await verifyToken(token);
  } catch (err) {
    console.error("[unsubscribe] verifyToken", err);
    return NextResponse.redirect(new URL("/user/settings?error=invalid_token", req.url));
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/user/settings?error=invalid_token", req.url));
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("firm_subscriptions")
    .update({ email_enabled: false })
    .eq("user_id", userId);

  if (error) {
    console.error("[unsubscribe] update", error);
    return NextResponse.redirect(new URL("/user/settings?error=update_failed", req.url));
  }

  return NextResponse.redirect(new URL("/user/settings?unsubscribed=1", req.url));
}
