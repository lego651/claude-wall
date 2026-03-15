/**
 * Deterministic video scoring formula — zero LLM cost.
 *
 * score = (normalized_views × 0.4) + (engagement_rate × 0.4) + (freshness_factor × 0.2)
 *
 * normalized_views   = video_views / max_views_in_set  (0–1)
 * engagement_rate    = min((likes + comments) / max(views, 1), 1.0)  (capped at 1.0)
 * freshness_factor   = max(0, 1 - (hours_since_published / windowHours))
 */

import type { RawVideo } from "./fetch-videos";

export interface ScoredVideo extends RawVideo {
  score: number;
}

export function scoreVideos(
  videos: RawVideo[],
  referenceDate: Date,
  windowHours = 24
): ScoredVideo[] {
  if (videos.length === 0) return [];

  const maxViews = Math.max(...videos.map((v) => v.views), 1);

  return videos.map((video) => {
    const normalizedViews = video.views / maxViews;

    const engagementRate = Math.min(
      (video.likes + video.comments) / Math.max(video.views, 1),
      1.0
    );

    const publishedAt = new Date(video.publishedAt);
    const hoursSincePublished =
      (referenceDate.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);
    const freshnessFactor = Math.max(
      0,
      1 - hoursSincePublished / windowHours
    );

    const score =
      normalizedViews * 0.4 + engagementRate * 0.4 + freshnessFactor * 0.2;

    return { ...video, score: Math.round(score * 10000) / 10000 };
  });
}

/**
 * Pick the top N videos by score, deduplicating by videoId.
 */
export function pickTopVideos(
  scoredVideos: ScoredVideo[],
  n = 3
): ScoredVideo[] {
  const seen = new Set<string>();
  const deduped = scoredVideos.filter((v) => {
    if (seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
  return deduped.sort((a, b) => b.score - a.score).slice(0, n);
}
