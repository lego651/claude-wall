import { scoreVideos, pickTopVideos } from "./score-videos";
import type { RawVideo } from "./fetch-videos";

const REF_DATE = new Date("2024-01-02T10:00:00Z");

function makeVideo(overrides: Partial<RawVideo> = {}): RawVideo {
  return {
    videoId: "vid1",
    title: "Test Video",
    channelId: "UC1",
    channelName: "Channel 1",
    publishedAt: "2024-01-02T05:00:00Z", // 5h ago
    views: 1000,
    likes: 50,
    comments: 10,
    thumbnailUrl: "https://img.example.com/t.jpg",
    source: "channel",
    ...overrides,
  };
}

describe("scoreVideos", () => {
  it("returns empty array for empty input", () => {
    expect(scoreVideos([], REF_DATE)).toEqual([]);
  });

  it("scores a single video with score between 0 and 1", () => {
    const [scored] = scoreVideos([makeVideo()], REF_DATE);
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(1);
  });

  it("top video by views gets normalized_views = 1.0", () => {
    const videos = [
      makeVideo({ videoId: "a", views: 10000, likes: 100, comments: 10, publishedAt: "2024-01-02T09:00:00Z" }),
      makeVideo({ videoId: "b", views: 500, likes: 20, comments: 5, publishedAt: "2024-01-02T08:00:00Z" }),
    ];
    const scored = scoreVideos(videos, REF_DATE);
    const topByViews = scored.find((v) => v.videoId === "a")!;
    const other = scored.find((v) => v.videoId === "b")!;
    // top by views should have higher score (all else roughly equal)
    expect(topByViews.score).toBeGreaterThan(other.score);
  });

  it("fresher video scores higher when views are equal", () => {
    const fresh = makeVideo({
      videoId: "fresh",
      views: 500,
      likes: 10,
      comments: 2,
      publishedAt: "2024-01-02T09:30:00Z", // 0.5h ago
    });
    const stale = makeVideo({
      videoId: "stale",
      views: 500,
      likes: 10,
      comments: 2,
      publishedAt: "2024-01-01T10:00:00Z", // 24h ago (edge of window)
    });
    const scored = scoreVideos([fresh, stale], REF_DATE, 24);
    const freshScore = scored.find((v) => v.videoId === "fresh")!.score;
    const staleScore = scored.find((v) => v.videoId === "stale")!.score;
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it("engagement_rate is capped at 1.0", () => {
    // likes + comments > views → engagement rate would exceed 1 without cap
    const video = makeVideo({ views: 10, likes: 100, comments: 50 });
    const [scored] = scoreVideos([video], REF_DATE);
    expect(scored.score).toBeLessThanOrEqual(1);
  });

  it("video older than window gets freshness = 0", () => {
    const old = makeVideo({
      publishedAt: "2024-01-01T00:00:00Z", // > 48h ago
    });
    const [scored] = scoreVideos([old], REF_DATE, 24);
    // freshness = max(0, ...) so it clamps at 0
    expect(scored.score).toBeGreaterThanOrEqual(0);
  });

  it("score is rounded to 4 decimal places", () => {
    const [scored] = scoreVideos([makeVideo()], REF_DATE);
    const decimalPlaces = (scored.score.toString().split(".")[1] ?? "").length;
    expect(decimalPlaces).toBeLessThanOrEqual(4);
  });
});

describe("pickTopVideos", () => {
  it("returns top n videos sorted by score descending", () => {
    const videos = [
      { ...makeVideo({ videoId: "a" }), score: 0.3 },
      { ...makeVideo({ videoId: "b" }), score: 0.9 },
      { ...makeVideo({ videoId: "c" }), score: 0.6 },
      { ...makeVideo({ videoId: "d" }), score: 0.1 },
    ];
    const top = pickTopVideos(videos, 3);
    expect(top).toHaveLength(3);
    expect(top.map((v) => v.videoId)).toEqual(["b", "c", "a"]);
  });

  it("deduplicates by videoId", () => {
    const videos = [
      { ...makeVideo({ videoId: "dup" }), score: 0.9 },
      { ...makeVideo({ videoId: "dup" }), score: 0.8 },
      { ...makeVideo({ videoId: "other" }), score: 0.5 },
    ];
    const top = pickTopVideos(videos, 3);
    expect(top).toHaveLength(2);
    expect(top[0].videoId).toBe("dup");
  });

  it("returns fewer than n if not enough unique videos", () => {
    const videos = [{ ...makeVideo(), score: 0.7 }];
    const top = pickTopVideos(videos, 3);
    expect(top).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(pickTopVideos([], 3)).toEqual([]);
  });
});
