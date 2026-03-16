/**
 * Returns today's top-15 YouTube candidates for the debug page.
 * Also exposes POST to trigger a fresh ingest run.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("youtube_daily_candidates")
      .select("*")
      .eq("candidate_date", today)
      .order("rank");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    return NextResponse.json({
      merged: rows.filter((r) => r.pool === "merged" || !r.pool),
      channelPool: rows.filter((r) => r.pool === "channel"),
      keywordPool: rows.filter((r) => r.pool === "keyword"),
      date: today,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const { runYouTubeIngest } = await import("@/lib/youtube/ingest");
    const result = await runYouTubeIngest();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
