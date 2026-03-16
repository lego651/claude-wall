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
 *   8. Upsert top 15 into youtube_daily_candidates for debug/tuning
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
import { scoreAndMerge, pickTopVideos, type ScoredVideo } from "./score-videos";
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

  // 3. Load active keywords — rotate through long lists within quota budget.
  // search.list costs 100 units each; daily budget is 10,000 units.
  // We reserve ~2,000 units for channel ops, leaving room for ~60 keyword searches.
  const KEYWORD_SEARCH_LIMIT = 60;

  const { data: keywordRows, error: kwErr } = await supabase
    .from("youtube_keywords")
    .select("id, keyword, last_searched_at")
    .eq("active", true)
    .order("last_searched_at", { ascending: true, nullsFirst: true })
    .limit(KEYWORD_SEARCH_LIMIT);

  if (kwErr) errors.push(`Failed to load keywords: ${kwErr.message}`);
  const keywordRecords = (keywordRows ?? []) as { id: string; keyword: string; last_searched_at: string | null }[];
  const keywords = keywordRecords.map((r) => r.keyword);

  // 4. Fetch videos — try 24h window first, extend to 48h if < 3.
  // Keep channel and keyword videos separate so each pool can be scored independently.
  let windowHours = 24;
  let channelVideos: RawVideo[] = [];
  let keywordVideos: RawVideo[] = [];

  let fetchAborted = false;
  for (const attempt of [24, 48]) {
    windowHours = attempt;

    try {
      channelVideos = await fetchVideosFromChannels(
        channels,
        apiKey,
        referenceDate,
        windowHours
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Channel fetch failed: ${msg}`);
      fetchAborted = true;
      break;
    }

    keywordVideos = [];
    for (const keyword of keywords) {
      try {
        const vids = await fetchVideosByKeyword(
          keyword,
          apiKey,
          referenceDate,
          windowHours
        );
        keywordVideos.push(...vids);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Keyword fetch failed: ${msg}`);
        fetchAborted = true;
        break;
      }
    }

    if (fetchAborted || channelVideos.length + keywordVideos.length >= 3) break;
  }

  // Mark searched keywords so rotation picks least-recently-searched next run.
  if (keywordRecords.length > 0) {
    const ids = keywordRecords.map((r) => r.id);
    const { error: updateErr } = await supabase
      .from("youtube_keywords")
      .update({ last_searched_at: referenceDate.toISOString() })
      .in("id", ids);
    if (updateErr) errors.push(`Failed to update last_searched_at: ${updateErr.message}`);
  }

  // 5. Score each pool independently then merge.
  // Channel and keyword pools normalize views within their own set so high-view
  // keyword results don't suppress channel video scores.
  const { merged, channelPool, keywordPool } = scoreAndMerge(
    channelVideos,
    keywordVideos,
    referenceDate,
    windowHours
  );
  const top15 = pickTopVideos(merged, 15);
  const top3 = top15.slice(0, 3);

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

  // 8. Upsert candidates for debug/tuning — three pools stored separately:
  //    merged (top 15), channel (top 10), keyword (top 10)
  const buildCandidateRows = (videos: ScoredVideo[], pool: string) =>
    videos.map((video, i) => ({
      candidate_date: pickDate,
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
      source: video.source,
      window_hours: windowHours,
      pool,
    }));

  const allCandidateRows = [
    ...buildCandidateRows(top15, "merged"),
    ...buildCandidateRows(channelPool, "channel"),
    ...buildCandidateRows(keywordPool, "keyword"),
  ];

  if (allCandidateRows.length > 0) {
    const { error: candErr } = await supabase
      .from("youtube_daily_candidates")
      .upsert(allCandidateRows, { onConflict: "candidate_date,rank,pool" });
    if (candErr) {
      errors.push(`Failed to upsert candidates: ${candErr.message}`);
    }
  }

  return {
    date: pickDate,
    candidatesFound: channelVideos.length + keywordVideos.length,
    windowHoursUsed: windowHours,
    picksInserted,
    errors,
  };
}
