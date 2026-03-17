import {
  resolveUploadPlaylistId,
  getPlaylistVideoIds,
  getVideoStats,
  fetchVideosFromChannels,
  fetchVideosByKeyword,
} from "./fetch-videos";

const API_KEY = "test-api-key";

function mockFetch(response: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => response,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("resolveUploadPlaylistId", () => {
  it("returns upload playlist id from API response", async () => {
    mockFetch({
      items: [
        {
          contentDetails: {
            relatedPlaylists: { uploads: "UUabcdef" },
          },
        },
      ],
    });
    const result = await resolveUploadPlaylistId("UCabcdef", API_KEY);
    expect(result).toBe("UUabcdef");
  });

  it("returns null if no items", async () => {
    mockFetch({ items: [] });
    const result = await resolveUploadPlaylistId("UCabcdef", API_KEY);
    expect(result).toBeNull();
  });

  it("returns null on HTTP error", async () => {
    mockFetch({}, false);
    const result = await resolveUploadPlaylistId("UCabcdef", API_KEY);
    expect(result).toBeNull();
  });
});

describe("getPlaylistVideoIds", () => {
  it("returns video ids and publishedAt", async () => {
    mockFetch({
      items: [
        { contentDetails: { videoId: "vid1", videoPublishedAt: "2024-01-01T00:00:00Z" } },
        { contentDetails: { videoId: "vid2", videoPublishedAt: "2024-01-02T00:00:00Z" } },
      ],
    });
    const result = await getPlaylistVideoIds("PLtest", API_KEY);
    expect(result).toHaveLength(2);
    expect(result[0].videoId).toBe("vid1");
  });

  it("filters out items with empty videoId", async () => {
    mockFetch({
      items: [
        { contentDetails: { videoId: "", videoPublishedAt: "2024-01-01T00:00:00Z" } },
        { contentDetails: { videoId: "vid2", videoPublishedAt: "2024-01-02T00:00:00Z" } },
      ],
    });
    const result = await getPlaylistVideoIds("PLtest", API_KEY);
    expect(result).toHaveLength(1);
  });

  it("throws on HTTP error", async () => {
    mockFetch({ error: { message: "quota exceeded" } }, false);
    await expect(getPlaylistVideoIds("PLtest", API_KEY)).rejects.toThrow("YouTube API");
  });
});

describe("getVideoStats", () => {
  it("returns empty object for empty input", async () => {
    const result = await getVideoStats([], API_KEY);
    expect(result).toEqual({});
  });

  it("maps video stats from API response with isLiveStream=false for regular video", async () => {
    mockFetch({
      items: [
        {
          id: "vid1",
          snippet: {
            title: "Test Video",
            channelId: "UCtest",
            channelTitle: "Test Channel",
            liveBroadcastContent: "none",
            thumbnails: { medium: { url: "https://img.example.com/medium.jpg" } },
          },
          statistics: { viewCount: "1000", likeCount: "50", commentCount: "10" },
          // no liveStreamingDetails → regular video
        },
      ],
    });
    const result = await getVideoStats(["vid1"], API_KEY);
    expect(result["vid1"]).toMatchObject({
      title: "Test Video",
      views: 1000,
      likes: 50,
      comments: 10,
      isLiveStream: false,
    });
  });

  it("sets isLiveStream=true when liveStreamingDetails is present (ended live VOD)", async () => {
    mockFetch({
      items: [
        {
          id: "live1",
          snippet: {
            title: "Live Trading VOD",
            channelId: "UC1",
            channelTitle: "Channel 1",
            liveBroadcastContent: "none", // stream has ended
            thumbnails: {},
          },
          statistics: { viewCount: "5000", likeCount: "10", commentCount: "0" },
          liveStreamingDetails: {
            actualStartTime: "2024-01-02T08:00:00Z",
            actualEndTime: "2024-01-02T14:00:00Z",
          },
        },
      ],
    });
    const result = await getVideoStats(["live1"], API_KEY);
    expect(result["live1"].isLiveStream).toBe(true);
  });

  it("sets isLiveStream=true when liveBroadcastContent=live (currently streaming)", async () => {
    mockFetch({
      items: [
        {
          id: "live2",
          snippet: {
            title: "Live Now",
            channelId: "UC1",
            channelTitle: "Channel 1",
            liveBroadcastContent: "live",
            thumbnails: {},
          },
          statistics: { viewCount: "15000", likeCount: "100", commentCount: "0" },
          // no liveStreamingDetails yet (or present — either way should detect)
        },
      ],
    });
    const result = await getVideoStats(["live2"], API_KEY);
    expect(result["live2"].isLiveStream).toBe(true);
  });

  it("skips items with empty id", async () => {
    mockFetch({
      items: [
        {
          id: "",
          snippet: { title: "X", channelId: "UC1", channelTitle: "Ch", thumbnails: {} },
          statistics: { viewCount: "0" },
        },
      ],
    });
    const result = await getVideoStats(["vid1"], API_KEY);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles HTTP error gracefully", async () => {
    mockFetch({}, false);
    const result = await getVideoStats(["vid1"], API_KEY);
    expect(result).toEqual({});
  });
});

describe("fetchVideosFromChannels", () => {
  const referenceDate = new Date("2024-01-02T10:00:00Z");

  it("returns empty videos when no channels have playlist ids", async () => {
    const result = await fetchVideosFromChannels(
      [{ channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: null }],
      API_KEY,
      referenceDate
    );
    expect(result.videos).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("skips videos outside the window", async () => {
    // playlist returns a video from 3 days ago (outside 24h window)
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              contentDetails: {
                videoId: "vid1",
                videoPublishedAt: "2023-12-28T00:00:00Z",
              },
            },
          ],
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });

    const result = await fetchVideosFromChannels(
      [{ channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: "UU1" }],
      API_KEY,
      referenceDate
    );
    expect(result.videos).toEqual([]);
  });

  it("returns videos within the window with isLiveStream=false for regular videos", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { contentDetails: { videoId: "vid1", videoPublishedAt: "2024-01-02T08:00:00Z" } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "vid1",
              snippet: {
                title: "Great Trade",
                channelId: "UC1",
                channelTitle: "Ch1",
                liveBroadcastContent: "none",
                thumbnails: { medium: { url: "https://img.example.com/t.jpg" } },
              },
              statistics: { viewCount: "5000", likeCount: "200", commentCount: "30" },
              // no liveStreamingDetails → regular video
            },
          ],
        }),
      });

    const result = await fetchVideosFromChannels(
      [{ channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: "UU1" }],
      API_KEY,
      referenceDate
    );
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe("vid1");
    expect(result.videos[0].source).toBe("channel");
    expect(result.videos[0].isLiveStream).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it("sets isLiveStream=true for live broadcast videos (via liveStreamingDetails)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { contentDetails: { videoId: "live1", videoPublishedAt: "2024-01-02T09:00:00Z" } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "live1",
              snippet: {
                title: "Live Day Trading",
                channelId: "UC1",
                channelTitle: "Ch1",
                liveBroadcastContent: "none", // stream ended
                thumbnails: {},
              },
              statistics: { viewCount: "15000", likeCount: "100", commentCount: "0" },
              liveStreamingDetails: { actualStartTime: "2024-01-02T08:00:00Z", actualEndTime: "2024-01-02T14:00:00Z" },
            },
          ],
        }),
      });

    const result = await fetchVideosFromChannels(
      [{ channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: "UU1" }],
      API_KEY,
      referenceDate
    );
    expect(result.videos[0].isLiveStream).toBe(true);
  });

  it("skips channel with stale playlist (404) and records error, continues other channels", async () => {
    global.fetch = jest
      .fn()
      // Channel 1 playlist: 404
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: { message: "The playlist cannot be found." } }),
      })
      // Channel 2 playlist: success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ contentDetails: { videoId: "vid2", videoPublishedAt: "2024-01-02T08:00:00Z" } }],
        }),
      })
      // videos.list stats for vid2
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "vid2",
              snippet: { title: "Good Video", channelId: "UC2", channelTitle: "Ch2", thumbnails: {} },
              statistics: { viewCount: "1000", likeCount: "50", commentCount: "5" },
            },
          ],
        }),
      });

    const result = await fetchVideosFromChannels(
      [
        { channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: "UU1" },
        { channel_id: "UC2", channel_name: "Ch2", upload_playlist_id: "UU2" },
      ],
      API_KEY,
      referenceDate
    );
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].videoId).toBe("vid2");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/UC1/);
  });

  it("re-throws quota (403) errors to abort all channels", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: async () => ({ error: { message: "403 quota exceeded" } }),
    });

    await expect(
      fetchVideosFromChannels(
        [{ channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: "UU1" }],
        API_KEY,
        referenceDate
      )
    ).rejects.toThrow("403");
  });
});

describe("fetchVideosByKeyword", () => {
  const referenceDate = new Date("2024-01-02T10:00:00Z");

  it("throws on HTTP error", async () => {
    mockFetch({ error: { message: "quota exceeded" } }, false);
    await expect(fetchVideosByKeyword("prop firm", API_KEY, referenceDate)).rejects.toThrow("YouTube API");
  });

  it("returns empty array when no search items", async () => {
    mockFetch({ items: [] });
    const result = await fetchVideosByKeyword("prop firm", API_KEY, referenceDate);
    expect(result).toEqual([]);
  });

  it("fetches video stats and builds RawVideo objects with isLiveStream=false", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: { videoId: "kw1" },
              snippet: {
                title: "Keyword Video",
                channelId: "UCkw",
                channelTitle: "KW Channel",
                publishedAt: "2024-01-02T09:00:00Z",
                liveBroadcastContent: "none",
                thumbnails: { medium: { url: "https://img.example.com/kw.jpg" } },
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "kw1",
              snippet: {
                title: "Keyword Video",
                channelId: "UCkw",
                channelTitle: "KW Channel",
                liveBroadcastContent: "none",
                thumbnails: { medium: { url: "https://img.example.com/kw.jpg" } },
              },
              statistics: { viewCount: "3000", likeCount: "100", commentCount: "20" },
            },
          ],
        }),
      });

    const result = await fetchVideosByKeyword("prop firm", API_KEY, referenceDate);
    expect(result).toHaveLength(1);
    expect(result[0].videoId).toBe("kw1");
    expect(result[0].source).toBe("keyword");
    expect(result[0].views).toBe(3000);
    expect(result[0].isLiveStream).toBe(false);
  });

  it("sets isLiveStream=true when liveStreamingDetails present in stats (ended live VOD)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: { videoId: "live2" },
              snippet: {
                title: "Live Stream VOD",
                channelId: "UCkw",
                channelTitle: "KW Channel",
                publishedAt: "2024-01-02T09:00:00Z",
                liveBroadcastContent: "none",
                thumbnails: {},
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "live2",
              snippet: { title: "Live Stream VOD", channelId: "UCkw", channelTitle: "KW Channel", liveBroadcastContent: "none", thumbnails: {} },
              statistics: { viewCount: "20000", likeCount: "50", commentCount: "0" },
              liveStreamingDetails: { actualStartTime: "2024-01-02T08:00:00Z", actualEndTime: "2024-01-02T12:00:00Z" },
            },
          ],
        }),
      });

    const result = await fetchVideosByKeyword("live trading", API_KEY, referenceDate);
    expect(result[0].isLiveStream).toBe(true);
  });
});
