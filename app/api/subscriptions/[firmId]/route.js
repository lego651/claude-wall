/**
 * Subscription API - Unfollow a firm
 * TICKET-012: DELETE /api/subscriptions/[firmId]
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(req, { params }) {
  try {
    const { firmId } = await params;
    const firm_id =
      typeof firmId === "string" ? firmId.trim().toLowerCase() : null;

    if (!firm_id) {
      return NextResponse.json(
        { error: "Firm ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: deleted, error } = await supabase
      .from("user_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("firm_id", firm_id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[subscriptions DELETE]", error);
      return NextResponse.json(
        { error: "Failed to delete subscription" },
        { status: 500 }
      );
    }

    if (!deleted) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[subscriptions DELETE]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
