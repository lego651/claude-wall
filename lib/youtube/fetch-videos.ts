/**
 * YouTube Data API v3 fetcher for the daily news ingest pipeline.
 *
 * Uses the cheap playlist approach (1 unit per channel) instead of search.list
 * (100 units) to stay well within the 10,000 unit/day free quota.
 *
 * Quota breakdown per daily run (~200 channels, 10 keywords):
 *   channels.list   × 200 = 200 units  (upload playlist ID, cached in DB)
 *   playlistItems.list × 200 = 200 units
 *   videos.list batched     = ~10 units
 *   search.list × 10        = 1,000 units
 *   Total ≈ 1,410 / 10,000 free units
 */

const YT_BASE = "https://www.googleapis.com/youtube/v3";

export interface RawVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  publishedAt: string; // ISO 8601
  views: number;
  likes: number;
  comments: number;
  thumbnailUrl: string;
  source: "channel" | "keyword";
}

export interface ChannelRow {
  channel_id: string;
  channel_name: string;
  upload_playlist_id: string | null;
}

/**
 * Resolve the uploads playlist ID for a channel (UCxxxxxxx → UUxxxxxxx).
 * Returns null on error so the caller can skip the channel.
 */
export async function resolveUploadPlaylistId(
  channelId: string,
  apiKey: string
): Promise<string | null> {
  const url = `${YT_BASE}/channels?part=contentDetails&id=${encodeURIComponent(channelId)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
  };
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

/**
 * Get the most recent video IDs from an uploads playlist (last 50 items = 1 unit).
 */
export async function getPlaylistVideoIds(
  playlistId: string,
  apiKey: string,
  maxResults = 10
): Promise<{ videoId: string; publishedAt: string }[]> {
  const url =
    `${YT_BASE}/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(playlistId)}` +
    `&maxResults=${maxResults}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    items?: { contentDetails?: { videoId?: string; videoPublishedAt?: string } }[];
  };
  return (data.items ?? [])
    .map((item) => ({
      videoId: item.contentDetails?.videoId ?? "",
      publishedAt: item.contentDetails?.videoPublishedAt ?? "",
    }))
    .filter((v) => v.videoId);
}

/**
 * Batch-fetch video stats for up to 50 video IDs per call (1 unit per batch).
 */
export async function getVideoStats(
  videoIds: string[],
  apiKey: string
): Promise<
  Record<
    string,
    { title: string; channelId: string; channelName: string; views: number; likes: number; comments: number; thumbnailUrl: string }
  >
> {
  if (videoIds.length === 0) return {};

  const BATCH = 50;
  const result: Record<
    string,
    { title: string; channelId: string; channelName: string; views: number; likes: number; comments: number; thumbnailUrl: string }
  > = {};

  for (let i = 0; i < videoIds.length; i += BATCH) {
    const batch = videoIds.slice(i, i + BATCH);
    const ids = batch.map(encodeURIComponent).join(",");
    const url =
      `${YT_BASE}/videos?part=snippet,statistics&id=${ids}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) continue;

    const data = (await res.json()) as {
      items?: {
        id?: string;
        snippet?: {
          title?: string;
          channelId?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
        };
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }[];
    };

    for (const item of data.items ?? []) {
      const id = item.id ?? "";
      if (!id) continue;
      result[id] = {
        title: item.snippet?.title ?? "",
        channelId: item.snippet?.channelId ?? "",
        channelName: item.snippet?.channelTitle ?? "",
        views: parseInt(item.statistics?.viewCount ?? "0", 10) || 0,
        likes: parseInt(item.statistics?.likeCount ?? "0", 10) || 0,
        comments: parseInt(item.statistics?.commentCount ?? "0", 10) || 0,
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          "",
      };
    }
  }

  return result;
}

/**
 * Fetch recent videos from a list of channels.
 * Each channel must have upload_playlist_id already resolved.
 * Only returns videos published within `windowHours` hours of `referenceDate`.
 */
export async function fetchVideosFromChannels(
  channels: ChannelRow[],
  apiKey: string,
  referenceDate: Date,
  windowHours = 24
): Promise<RawVideo[]> {
  const cutoff = new Date(referenceDate.getTime() - windowHours * 60 * 60 * 1000);
  const allVideoIds: { videoId: string; publishedAt: string; channelId: string; channelName: string }[] = [];

  for (const ch of channels) {
    if (!ch.upload_playlist_id) continue;
    const items = await getPlaylistVideoIds(ch.upload_playlist_id, apiKey, 10);
    for (const item of items) {
      if (!item.publishedAt) continue;
      const pub = new Date(item.publishedAt);
      if (pub >= cutoff && pub <= referenceDate) {
        allVideoIds.push({
          videoId: item.videoId,
          publishedAt: item.publishedAt,
          channelId: ch.channel_id,
          channelName: ch.channel_name,
        });
      }
    }
  }

  if (allVideoIds.length === 0) return [];

  const statsMap = await getVideoStats(
    allVideoIds.map((v) => v.videoId),
    apiKey
  );

  const channelVideos = allVideoIds.flatMap((v) => {
    const stats = statsMap[v.videoId];
    if (!stats) return [];
    const video: RawVideo = {
      videoId: v.videoId,
      title: stats.title,
      channelId: v.channelId,
      channelName: v.channelName,
      publishedAt: v.publishedAt,
      views: stats.views,
      likes: stats.likes,
      comments: stats.comments,
      thumbnailUrl: stats.thumbnailUrl,
      source: "channel",
    };
    return [video];
  });
  return channelVideos;
}

/**
 * Fetch videos matching a keyword search (100 units per call — use sparingly).
 * Only returns videos published within `windowHours`.
 */
export async function fetchVideosByKeyword(
  keyword: string,
  apiKey: string,
  referenceDate: Date,
  windowHours = 24,
  maxResults = 10
): Promise<RawVideo[]> {
  const publishedAfter = new Date(referenceDate.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  const url =
    `${YT_BASE}/search?part=snippet&type=video&q=${encodeURIComponent(keyword)}` +
    `&publishedAfter=${publishedAfter}&maxResults=${maxResults}&order=viewCount&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelId?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      };
    }[];
  };

  const items = data.items ?? [];
  const videoIds = items.map((i) => i.id?.videoId ?? "").filter(Boolean);
  if (videoIds.length === 0) return [];

  const statsMap = await getVideoStats(videoIds, apiKey);

  return items.flatMap((item) => {
    const videoId = item.id?.videoId ?? "";
    if (!videoId) return [];
    const stats = statsMap[videoId];
    if (!stats) return [];
    const video: RawVideo = {
      videoId,
      title: item.snippet?.title ?? stats.title,
      channelId: item.snippet?.channelId ?? stats.channelId,
      channelName: item.snippet?.channelTitle ?? stats.channelName,
      publishedAt: item.snippet?.publishedAt ?? "",
      views: stats.views,
      likes: stats.likes,
      comments: stats.comments,
      thumbnailUrl:
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        stats.thumbnailUrl,
      source: "keyword",
    };
    return [video];
  });
}
