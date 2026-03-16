/**
 * Admin API: update a Twitter draft (approve, skip, edit tweet text, toggle auto-approve).
 * PATCH /api/admin/twitter/drafts/[id]
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface PatchBody {
  status?: "approved" | "skipped";
  tweet_text?: string;
  auto_approve?: boolean;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed: PatchBody = {};

  if (body.status !== undefined) {
    if (!["approved", "skipped"].includes(body.status)) {
      return NextResponse.json(
        { error: "status must be 'approved' or 'skipped'" },
        { status: 400 }
      );
    }
    allowed.status = body.status;
  }

  if (body.tweet_text !== undefined) {
    const text = body.tweet_text.trim();
    if (!text) {
      return NextResponse.json({ error: "tweet_text cannot be empty" }, { status: 400 });
    }
    if (text.length > 280) {
      return NextResponse.json(
        { error: `tweet_text too long: ${text.length} chars (max 280)` },
        { status: 400 }
      );
    }
    allowed.tweet_text = text;
  }

  if (body.auto_approve !== undefined) {
    allowed.auto_approve = Boolean(body.auto_approve);
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("twitter_drafts")
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: data });
}
