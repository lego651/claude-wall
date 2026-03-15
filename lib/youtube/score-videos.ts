/**
 * Deterministic video scoring formula — zero LLM cost.
 *
 * score = (normalized_views × 0.4) + (engagement_rate × 0.4) + (freshness_factor × 0.2)
 *
 * normalized_views   = video_views / max_views_in_set  (0–1)
 * engagement_rate    = min((likes + comments) / (views + ENGAGEMENT_SMOOTHING), 1.0)
 *                      Smoothing prevents low-view videos from getting a perfect
 *                      engagement score (e.g. 4 likes / 5 views = 0.80, not 1.0).
 * freshness_factor   = max(0, 1 - (hours_since_published / windowHours))
 *
 * Candidates with fewer than MIN_VIEWS are excluded before scoring.
 */

import type { RawVideo } from "./fetch-videos";

/** Videos with fewer views than this are filtered out before scoring. */
export const MIN_VIEWS = 100;

/**
 * Smoothing constant added to the denominator of engagement_rate.
 * Prevents tiny-sample manipulation (e.g. 5 likes / 5 views = 1.0).
 * At 500 views the effect is small (<20%); at 5 views it's decisive.
 */
export const ENGAGEMENT_SMOOTHING = 500;

export interface ScoredVideo extends RawVideo {
  score: number;
}

export function scoreVideos(
  videos: RawVideo[],
  referenceDate: Date,
  windowHours = 24
): ScoredVideo[] {
  if (videos.length === 0) return [];

  // Filter out low-view candidates — statistically unreliable engagement
  const eligible = videos.filter((v) => v.views >= MIN_VIEWS);
  if (eligible.length === 0) return [];

  const maxViews = Math.max(...eligible.map((v) => v.views), 1);

  return eligible.map((video) => {
    const normalizedViews = video.views / maxViews;

    // Smoothed engagement: adding ENGAGEMENT_SMOOTHING to denominator prevents
    // a video with 4 likes / 5 views from scoring equal to one with 10K likes / 500K views
    const engagementRate = Math.min(
      (video.likes + video.comments) / (video.views + ENGAGEMENT_SMOOTHING),
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
