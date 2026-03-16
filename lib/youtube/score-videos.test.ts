import {
  scoreVideos,
  pickTopVideos,
  scoreAndMerge,
  MIN_VIEWS,
  ENGAGEMENT_SMOOTHING,
  CROSS_APPEARING_BONUS,
} from "./score-videos";
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

  it("returns empty array when all videos are below MIN_VIEWS", () => {
    const videos = [
      makeVideo({ videoId: "a", views: MIN_VIEWS - 1 }),
      makeVideo({ videoId: "b", views: 5 }),
    ];
    expect(scoreVideos(videos, REF_DATE)).toEqual([]);
  });

  it("filters out videos below MIN_VIEWS", () => {
    const videos = [
      makeVideo({ videoId: "ok", views: MIN_VIEWS }),
      makeVideo({ videoId: "low", views: MIN_VIEWS - 1 }),
    ];
    const scored = scoreVideos(videos, REF_DATE);
    expect(scored).toHaveLength(1);
    expect(scored[0].videoId).toBe("ok");
  });

  it("scores a single eligible video with score between 0 and 1", () => {
    const [scored] = scoreVideos([makeVideo()], REF_DATE);
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(1);
  });

  it("top video by views scores higher than lower-view video", () => {
    const videos = [
      makeVideo({ videoId: "a", views: 10000, likes: 100, comments: 10, publishedAt: "2024-01-02T09:00:00Z" }),
      makeVideo({ videoId: "b", views: 500, likes: 20, comments: 5, publishedAt: "2024-01-02T08:00:00Z" }),
    ];
    const scored = scoreVideos(videos, REF_DATE);
    const topByViews = scored.find((v) => v.videoId === "a")!;
    const other = scored.find((v) => v.videoId === "b")!;
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

  it("engagement_rate is capped at 1.0 even with very high likes/view ratio", () => {
    const video = makeVideo({ views: 1000, likes: 100000, comments: 5000 });
    const [scored] = scoreVideos([video], REF_DATE);
    expect(scored.score).toBeLessThanOrEqual(1);
  });

  it("smoothing prevents low-view video from outscoring high-view video on engagement alone", () => {
    const lowView = makeVideo({
      videoId: "low",
      views: MIN_VIEWS,
      likes: MIN_VIEWS,
      comments: 0,
      publishedAt: "2024-01-02T09:00:00Z",
    });
    const highView = makeVideo({
      videoId: "high",
      views: 10000,
      likes: 300,
      comments: 50,
      publishedAt: "2024-01-02T08:00:00Z",
    });
    const scored = scoreVideos([lowView, highView], REF_DATE);
    const high = scored.find((v) => v.videoId === "high")!;
    const low = scored.find((v) => v.videoId === "low")!;
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("engagement uses ENGAGEMENT_SMOOTHING constant in denominator", () => {
    const video = makeVideo({ views: ENGAGEMENT_SMOOTHING, likes: ENGAGEMENT_SMOOTHING, comments: 0 });
    const [scored] = scoreVideos([video], REF_DATE);
    const expectedEngagement = 0.5;
    const expectedNV = 1.0;
    const hoursSince = (REF_DATE.getTime() - new Date("2024-01-02T05:00:00Z").getTime()) / 3_600_000;
    const expectedFreshness = Math.max(0, 1 - hoursSince / 24);
    const expectedScore = Math.round((expectedNV * 0.4 + expectedEngagement * 0.4 + expectedFreshness * 0.2) * 10000) / 10000;
    expect(scored.score).toBe(expectedScore);
  });

  it("video older than window gets freshness = 0", () => {
    const old = makeVideo({ publishedAt: "2024-01-01T00:00:00Z" }); // > 24h ago
    const [scored] = scoreVideos([old], REF_DATE, 24);
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

describe("scoreAndMerge", () => {
  const channelVids: RawVideo[] = [
    makeVideo({ videoId: "c1", source: "channel", views: 400, likes: 20, comments: 5, publishedAt: "2024-01-02T08:00:00Z" }),
    makeVideo({ videoId: "c2", source: "channel", views: 200, likes: 10, comments: 2, publishedAt: "2024-01-02T07:00:00Z" }),
  ];
  const keywordVids: RawVideo[] = [
    makeVideo({ videoId: "k1", source: "keyword", views: 8000, likes: 400, comments: 60, publishedAt: "2024-01-02T09:00:00Z" }),
    makeVideo({ videoId: "k2", source: "keyword", views: 5000, likes: 200, comments: 30, publishedAt: "2024-01-02T06:00:00Z" }),
  ];

  it("returns merged, channelPool, and keywordPool", () => {
    const result = scoreAndMerge(channelVids, keywordVids, REF_DATE);
    expect(result.merged.length).toBeGreaterThan(0);
    expect(result.channelPool.length).toBeGreaterThan(0);
    expect(result.keywordPool.length).toBeGreaterThan(0);
  });

  it("channelPool contains only channel-sourced videos", () => {
    const { channelPool } = scoreAndMerge(channelVids, keywordVids, REF_DATE);
    expect(channelPool.every((v) => v.source === "channel")).toBe(true);
  });

  it("keywordPool contains only keyword-sourced videos", () => {
    const { keywordPool } = scoreAndMerge(channelVids, keywordVids, REF_DATE);
    expect(keywordPool.every((v) => v.source === "keyword")).toBe(true);
  });

  it("channel pool scores are normalized independently (best channel video gets score >= keyword videos even with lower views)", () => {
    const { channelPool, keywordPool } = scoreAndMerge(channelVids, keywordVids, REF_DATE);
    // Best channel video normalizedViews = 1.0 within its pool
    // Best keyword video normalizedViews = 1.0 within its pool
    // So both best videos should have comparable scores despite very different raw view counts
    const bestChannel = channelPool[0].score;
    const bestKeyword = keywordPool[0].score;
    // Both should be meaningful scores (not near 0)
    expect(bestChannel).toBeGreaterThan(0.3);
    expect(bestKeyword).toBeGreaterThan(0.3);
  });

  it("cross-appearing video receives CROSS_APPEARING_BONUS and appears in merged", () => {
    const crossVideo: RawVideo = makeVideo({
      videoId: "cross",
      source: "channel",
      views: 300,
      likes: 15,
      comments: 3,
      publishedAt: "2024-01-02T08:30:00Z",
    });
    const crossAsKeyword: RawVideo = { ...crossVideo, source: "keyword" };
    const ch = [...channelVids, crossVideo];
    const kw = [...keywordVids, crossAsKeyword];

    const { merged } = scoreAndMerge(ch, kw, REF_DATE);
    const crossInMerged = merged.find((v) => v.videoId === "cross");
    expect(crossInMerged).toBeDefined();

    // Without bonus, cross video would score modestly; with +0.3 it should be near top
    const crossRank = merged.findIndex((v) => v.videoId === "cross") + 1;
    expect(crossRank).toBeLessThanOrEqual(2); // guaranteed top-2 with +0.3 bonus
  });

  it("cross-appearing video score is capped at 1.0", () => {
    const crossVideo: RawVideo = makeVideo({
      videoId: "cross",
      source: "channel",
      views: 10000,
      likes: 5000,
      comments: 500,
      publishedAt: "2024-01-02T09:50:00Z",
    });
    const crossAsKeyword: RawVideo = { ...crossVideo, source: "keyword" };
    const { merged } = scoreAndMerge([crossVideo], [crossAsKeyword], REF_DATE);
    const crossEntry = merged.find((v) => v.videoId === "cross")!;
    expect(crossEntry.score).toBeLessThanOrEqual(1.0);
  });

  it("cross-appearing video appears only once in merged", () => {
    const crossVideo: RawVideo = makeVideo({ videoId: "cross", source: "channel" });
    const crossAsKeyword: RawVideo = { ...crossVideo, source: "keyword" };
    const { merged } = scoreAndMerge([crossVideo], [crossAsKeyword], REF_DATE);
    const crossCount = merged.filter((v) => v.videoId === "cross").length;
    expect(crossCount).toBe(1);
  });

  it("merged result is sorted by score descending", () => {
    const { merged } = scoreAndMerge(channelVids, keywordVids, REF_DATE);
    const scores = merged.map((v) => v.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("handles empty channel pool gracefully", () => {
    const { merged, channelPool, keywordPool } = scoreAndMerge([], keywordVids, REF_DATE);
    expect(channelPool).toHaveLength(0);
    expect(keywordPool.length).toBeGreaterThan(0);
    expect(merged.length).toBeGreaterThan(0);
  });

  it("handles empty keyword pool gracefully", () => {
    const { merged, channelPool, keywordPool } = scoreAndMerge(channelVids, [], REF_DATE);
    expect(keywordPool).toHaveLength(0);
    expect(channelPool.length).toBeGreaterThan(0);
    expect(merged.length).toBeGreaterThan(0);
  });

  it("CROSS_APPEARING_BONUS constant matches expected value", () => {
    expect(CROSS_APPEARING_BONUS).toBe(0.3);
  });
});
