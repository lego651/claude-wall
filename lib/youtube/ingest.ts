/**
 * YouTube daily ingest orchestrator.
 *
 * Called by the cron job at 07:00 UTC. Steps:
 *   1. Load active channels + keywords from DB
 *   2. Resolve missing upload_playlist_ids (cache in DB)
 *   3. Fetch recent videos from channels + keyword searches
 *   4. Score all candidates
 *   5. If < 3 in 24h window, extend to 48h and retry once
 *   6. Pick top 3, generate AI summaries
 *   7. Upsert into youtube_daily_picks for today
 *
 * Returns a structured result for the cron route to log.
 */

import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchVideosFromChannels,
  fetchVideosByKeyword,
  resolveUploadPlaylistId,
  type ChannelRow,
  type RawVideo,
} from "./fetch-videos";
import { scoreVideos, pickTopVideos, type ScoredVideo } from "./score-videos";
import { summarizeVideos } from "./summarize-video";

export interface IngestResult {
  date: string; // YYYY-MM-DD UTC
  candidatesFound: number;
  windowHoursUsed: number;
  picksInserted: number;
  errors: string[];
}

export async function runYouTubeIngest(
  referenceDate: Date = new Date()
): Promise<IngestResult> {
  const errors: string[] = [];
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is not set in environment");
  }

  const supabase = createServiceClient();
  const pickDate = referenceDate.toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // 1. Load active channels
  const { data: channelRows, error: chErr } = await supabase
    .from("youtube_channels")
    .select("channel_id, channel_name, upload_playlist_id")
    .eq("active", true);

  if (chErr) throw new Error(`Failed to load channels: ${chErr.message}`);
  const channels: ChannelRow[] = (channelRows ?? []) as ChannelRow[];

  // 2. Resolve missing upload_playlist_ids (cache result in DB)
  const channelsNeedingResolution = channels.filter(
    (ch) => !ch.upload_playlist_id
  );
  for (const ch of channelsNeedingResolution) {
    const playlistId = await resolveUploadPlaylistId(ch.channel_id, apiKey);
    if (playlistId) {
      ch.upload_playlist_id = playlistId;
      await supabase
        .from("youtube_channels")
        .update({ upload_playlist_id: playlistId, updated_at: new Date().toISOString() })
        .eq("channel_id", ch.channel_id);
    } else {
      errors.push(`Could not resolve playlist for channel ${ch.channel_id}`);
    }
  }

  // 3. Load active keywords
  const { data: keywordRows, error: kwErr } = await supabase
    .from("youtube_keywords")
    .select("keyword")
    .eq("active", true);

  if (kwErr) errors.push(`Failed to load keywords: ${kwErr.message}`);
  const keywords: string[] = ((keywordRows ?? []) as { keyword: string }[]).map(
    (r) => r.keyword
  );

  // 4. Fetch videos — try 24h window first, extend to 48h if < 3
  let windowHours = 24;
  let candidates: RawVideo[] = [];

  for (const attempt of [24, 48]) {
    windowHours = attempt;
    const channelVideos = await fetchVideosFromChannels(
      channels,
      apiKey,
      referenceDate,
      windowHours
    );

    const keywordVideos: RawVideo[] = [];
    for (const keyword of keywords) {
      const vids = await fetchVideosByKeyword(
        keyword,
        apiKey,
        referenceDate,
        windowHours
      );
      keywordVideos.push(...vids);
    }

    candidates = [...channelVideos, ...keywordVideos];
    if (candidates.length >= 3) break;
  }

  // 5. Score + pick top 3
  const scored: ScoredVideo[] = scoreVideos(candidates, referenceDate, windowHours);
  const top3 = pickTopVideos(scored, 3);

  // 6. Generate AI summaries
  const summaries = await summarizeVideos(
    top3.map((v) => ({
      title: v.title,
      channelName: v.channelName,
      views: v.views,
    }))
  );

  // 7. Upsert picks for today
  const rows = top3.map((video, i) => ({
    pick_date: pickDate,
    rank: i + 1,
    video_id: video.videoId,
    title: video.title,
    channel_name: video.channelName,
    channel_id: video.channelId,
    thumbnail_url: video.thumbnailUrl || null,
    video_url: `https://www.youtube.com/watch?v=${video.videoId}`,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    published_at: video.publishedAt,
    score: video.score,
    ai_summary: summaries[i] ?? null,
    source: video.source,
  }));

  let picksInserted = 0;
  if (rows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("youtube_daily_picks")
      .upsert(rows, { onConflict: "pick_date,rank" });

    if (upsertErr) {
      errors.push(`Failed to upsert picks: ${upsertErr.message}`);
    } else {
      picksInserted = rows.length;
    }
  }

  return {
    date: pickDate,
    candidatesFound: candidates.length,
    windowHoursUsed: windowHours,
    picksInserted,
    errors,
  };
}
