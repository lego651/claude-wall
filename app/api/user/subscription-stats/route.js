/**
 * GET /api/user/subscription-stats
 * S7-009: Subscription stats for dashboard (subscribed count, next digest date, firms).
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Next Sunday 8:00 AM UTC as ISO string. */
function getNextDigestDate() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysToAdd = day === 0 ? 7 : 7 - day;
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysToAdd,
      8,
      0,
      0,
      0
    )
  );
  return next.toISOString();
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: subscriptions, error } = await supabase
      .from("user_subscriptions")
      .select(
        `
        firm_id,
        firm_profiles (
          id,
          name,
          logo_url
        )
      `
      )
      .eq("user_id", user.id)
      .eq("email_enabled", true);

    if (error) {
      console.error("[subscription-stats GET]", error);
      return NextResponse.json(
        { error: "Failed to fetch subscription stats" },
        { status: 500 }
      );
    }

    const firms = (subscriptions || []).map((s) => ({
      id: s.firm_id,
      name: s.firm_profiles?.name ?? null,
      logo_url: s.firm_profiles?.logo_url ?? null,
    }));

    return NextResponse.json({
      subscribedCount: firms.length,
      nextDigestDate: getNextDigestDate(),
      firms,
    });
  } catch (err) {
    console.error("[subscription-stats GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
