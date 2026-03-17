/**
 * POST /api/events/youtube-expand
 *
 * Records an anonymous click event when a user expands the full video list on /news.
 * No auth required — fire-and-forget from the client.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event_type, metadata } = body;

  if (!event_type || typeof event_type !== "string") {
    return NextResponse.json({ error: "event_type is required" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("page_events")
      .insert({ event_type, metadata: metadata ?? null });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
