/**
 * Subscription API - List and create firm subscriptions (weekly digest)
 * TICKET-012: GET /api/subscriptions, POST /api/subscriptions
 *
 * GET: List firms the user follows (from firm_subscriptions).
 * POST: Subscribe to (follow) a firm. Validates firm exists; returns existing if already subscribed.
 */

import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

/** Return next Monday 00:00 UTC as ISO string (next digest date). */
function getNextDigestDate() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const daysToAdd = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysToAdd,
      0,
      0,
      0,
      0
    )
  );
  return next.toISOString().slice(0, 10);
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
      .from("firm_subscriptions")
      .select(
        `
        id,
        firm_id,
        subscribed_at,
        email_enabled,
        firms (
          id,
          name,
          logo_url,
          website
        )
      `
      )
      .eq("user_id", user.id)
      .order("subscribed_at", { ascending: false });

    if (error) {
      console.error("[subscriptions GET]", error);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    const nextDigestDate = getNextDigestDate();
    const items = (subscriptions || []).map((s) => ({
      id: s.id,
      firm_id: s.firm_id,
      firm: s.firms
        ? {
            id: s.firms.id,
            name: s.firms.name,
            logo_url: s.firms.logo_url ?? null,
            website: s.firms.website ?? null,
          }
        : null,
      subscribed_at: s.subscribed_at,
      email_enabled: s.email_enabled ?? true,
      next_report_date: nextDigestDate,
    }));

    return NextResponse.json({ subscriptions: items });
  } catch (err) {
    console.error("[subscriptions GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const firm_id =
      typeof body.firm_id === "string" ? body.firm_id.trim().toLowerCase() : null;
    if (!firm_id) {
      return NextResponse.json(
        { error: "firm_id is required" },
        { status: 400 }
      );
    }

    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("id, name, logo_url, website")
      .eq("id", firm_id)
      .maybeSingle();

    if (firmError || !firm) {
      return NextResponse.json(
        { error: "Firm not found" },
        { status: 404 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("firm_subscriptions")
      .select("id, subscribed_at, email_enabled")
      .eq("user_id", user.id)
      .eq("firm_id", firm_id)
      .maybeSingle();

    if (existingError) {
      console.error("[subscriptions POST] existing check", existingError);
      return NextResponse.json(
        { error: "Failed to check subscription" },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json({
        subscription: {
          id: existing.id,
          firm_id: firm.id,
          firm: {
            id: firm.id,
            name: firm.name,
            logo_url: firm.logo_url ?? null,
            website: firm.website ?? null,
          },
          subscribed_at: existing.subscribed_at,
          email_enabled: existing.email_enabled ?? true,
          next_report_date: getNextDigestDate(),
        },
        already_subscribed: true,
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("firm_subscriptions")
      .insert({
        user_id: user.id,
        firm_id: firm.id,
        email_enabled: true,
      })
      .select("id, subscribed_at, email_enabled")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: row } = await supabase
          .from("firm_subscriptions")
          .select("id, subscribed_at, email_enabled")
          .eq("user_id", user.id)
          .eq("firm_id", firm_id)
          .single();
        if (row) {
          return NextResponse.json({
            subscription: {
              id: row.id,
              firm_id: firm.id,
              firm: {
                id: firm.id,
                name: firm.name,
                logo_url: firm.logo_url ?? null,
                website: firm.website ?? null,
              },
              subscribed_at: row.subscribed_at,
              email_enabled: row.email_enabled ?? true,
              next_report_date: getNextDigestDate(),
            },
            already_subscribed: true,
          });
        }
      }
      console.error("[subscriptions POST] insert", insertError);
      return NextResponse.json(
        { error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscription: {
        id: inserted.id,
        firm_id: firm.id,
        firm: {
          id: firm.id,
          name: firm.name,
          logo_url: firm.logo_url ?? null,
          website: firm.website ?? null,
        },
        subscribed_at: inserted.subscribed_at,
        email_enabled: inserted.email_enabled ?? true,
        next_report_date: getNextDigestDate(),
      },
      already_subscribed: false,
    });
  } catch (err) {
    console.error("[subscriptions POST]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
