/**
 * Cron endpoint for daily YouTube news ingest.
 *
 * Called by GitHub Actions at 07:00 UTC daily (after Twitter pipeline).
 * Also callable manually for testing.
 *
 * Security: Protected by CRON_SECRET header in production.
 */

import { NextResponse } from "next/server";
import { runYouTubeIngest } from "@/lib/youtube/ingest";

export const maxDuration = 120; // YouTube API + AI summaries can take ~2 min
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startTime = Date.now();

  // Verify cron secret when CRON_SECRET is configured (production/staging).
  // If CRON_SECRET is not set (local dev), auth check is skipped.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log("[YouTube Cron] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log("[YouTube Cron] Starting daily YouTube news ingest...");

  try {
    const result = await runYouTubeIngest();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      ...result,
    };

    console.log("[YouTube Cron] Ingest complete:", response);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[YouTube Cron] Ingest failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
