/**
 * Cron: generate tomorrow's Twitter draft from today's YouTube picks.
 *
 * Runs nightly at 22:15 UTC (generates draft for the NEXT calendar day).
 * Idempotent: skips if a draft already exists for tomorrow.
 *
 * Security: protected by CRON_SECRET header in production.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateTweetDraft, type YouTubePickInput } from "@/lib/twitter-bot/generate-tweet";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startTime = Date.now();

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();

  // Draft is for the NEXT UTC day (this cron runs late at night)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const draftDate = tomorrow.toISOString().slice(0, 10);

  // Idempotency: skip if draft already exists
  const { data: existing } = await supabase
    .from("twitter_drafts")
    .select("id, status")
    .eq("draft_date", draftDate)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: `Draft for ${draftDate} already exists (status: ${existing.status})`,
      duration: Date.now() - startTime,
    });
  }

  // Fetch today's rank-1 pick
  const today = new Date().toISOString().slice(0, 10);
  const { data: picks, error: picksErr } = await supabase
    .from("youtube_daily_picks")
    .select("rank, video_id, title, channel_name, channel_id, video_url, ai_summary")
    .eq("pick_date", today)
    .eq("rank", 1)
    .limit(1);

  if (picksErr) {
    return NextResponse.json(
      { success: false, error: `Failed to load picks: ${picksErr.message}`, duration: Date.now() - startTime },
      { status: 500 }
    );
  }

  if (!picks || picks.length === 0) {
    return NextResponse.json({
      success: false,
      error: `No YouTube picks found for ${today} — run the YouTube ingest cron first`,
      duration: Date.now() - startTime,
    }, { status: 422 });
  }

  const row = picks[0] as {
    rank: number;
    video_id: string;
    title: string;
    channel_name: string;
    channel_id: string;
    video_url: string;
    ai_summary: string | null;
  };

  // Fetch twitter_handle for the pick's channel (separate query — no FK constraint)
  const { data: channelRow } = await supabase
    .from("youtube_channels")
    .select("twitter_handle")
    .eq("channel_id", row.channel_id)
    .maybeSingle();

  const pickInput: YouTubePickInput = {
    videoId: row.video_id,
    title: row.title,
    channelName: row.channel_name,
    channelId: row.channel_id,
    videoUrl: row.video_url,
    aiSummary: row.ai_summary,
    twitterHandle: (channelRow as { twitter_handle: string | null } | null)?.twitter_handle ?? null,
  };

  let draft;
  try {
    draft = await generateTweetDraft(pickInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Draft generation failed: ${message}`, duration: Date.now() - startTime },
      { status: 500 }
    );
  }

  const { error: insertErr } = await supabase.from("twitter_drafts").insert({
    draft_date: draftDate,
    tweet_text: draft.tweetText,
    template: draft.template,
    creator_handle: draft.creatorHandle,
    video_title: draft.videoTitle,
    video_url: draft.videoUrl,
    news_url: draft.newsUrl,
    status: "pending",
  });

  if (insertErr) {
    return NextResponse.json(
      { success: false, error: `Failed to save draft: ${insertErr.message}`, duration: Date.now() - startTime },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    draftDate,
    template: draft.template,
    creatorHandle: draft.creatorHandle,
    charCount: draft.charCount,
    duration: Date.now() - startTime,
  });
}
