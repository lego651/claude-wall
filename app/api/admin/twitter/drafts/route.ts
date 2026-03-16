/**
 * Admin API: list recent Twitter drafts.
 * GET /api/admin/twitter/drafts — returns last 14 days of drafts, newest first.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("twitter_drafts")
    .select(
      "id, draft_date, tweet_text, template, creator_handle, video_title, video_url, news_url, status, tweet_id, failure_reason, auto_approve, created_at, updated_at"
    )
    .gte("draft_date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    .order("draft_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ drafts: data ?? [] });
}
