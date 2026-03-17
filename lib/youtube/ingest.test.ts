import { runYouTubeIngest } from "./ingest";

// Mock all dependencies
jest.mock("@/lib/supabase/service");
jest.mock("./fetch-videos");
jest.mock("./score-videos");
jest.mock("./summarize-video");

import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchVideosFromChannels,
  fetchVideosByKeyword,
  resolveUploadPlaylistId,
} from "./fetch-videos";
import { scoreAndMerge, pickTopVideos } from "./score-videos";
import { summarizeVideos } from "./summarize-video";

const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockUpsert = jest.fn();
const mockIn = jest.fn();

// Build a keywords query chain: .select().eq().order().limit() → resolves
function makeKeywordChain(data: unknown[], error: null | { message: string } = null) {
  const mockLimit = jest.fn().mockResolvedValue({ data, error });
  const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockEqFn = jest.fn().mockReturnValue({ order: mockOrder });
  return { eq: mockEqFn };
}

// Build a channels query chain: .select().eq() → resolves
function makeChannelChain(data: unknown[], error: null | { message: string } = null) {
  return { eq: jest.fn().mockResolvedValue({ data, error }) };
}

function buildSupabaseMock() {
  mockIn.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq, in: mockIn });
  mockUpsert.mockResolvedValue({ error: null });

  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    update: mockUpdate,
    upsert: mockUpsert,
  }));

  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
}

const REFERENCE_DATE = new Date("2024-01-02T10:00:00Z");

const MOCK_CHANNELS = [
  { channel_id: "UC1", channel_name: "Channel 1", upload_playlist_id: "UU1" },
];
const MOCK_KEYWORDS = [{ id: "kw1", keyword: "prop firm", last_searched_at: null }];

const MOCK_RAW_VIDEOS = [
  {
    videoId: "vid1",
    title: "Top Prop Firm Tips",
    channelId: "UC1",
    channelName: "Channel 1",
    publishedAt: "2024-01-02T08:00:00Z",
    views: 5000,
    likes: 200,
    comments: 30,
    thumbnailUrl: "https://img.example.com/t.jpg",
    source: "channel" as const,
    isLiveStream: false,
  },
  {
    videoId: "vid2",
    title: "Prop Firm Review 2024",
    channelId: "UCkw",
    channelName: "KW Channel",
    publishedAt: "2024-01-02T07:00:00Z",
    views: 3000,
    likes: 100,
    comments: 15,
    thumbnailUrl: "https://img.example.com/t2.jpg",
    source: "keyword" as const,
    isLiveStream: false,
  },
  {
    videoId: "vid3",
    title: "FTMO Challenge Guide",
    channelId: "UC1",
    channelName: "Channel 1",
    publishedAt: "2024-01-02T06:00:00Z",
    views: 8000,
    likes: 400,
    comments: 60,
    thumbnailUrl: "https://img.example.com/t3.jpg",
    source: "channel" as const,
    isLiveStream: false,
  },
];

const MOCK_LIVE_VIDEO = {
  videoId: "live1",
  title: "Live Futures Trading Session",
  channelId: "UC1",
  channelName: "Channel 1",
  publishedAt: "2024-01-02T09:00:00Z",
  views: 25000,
  likes: 300,
  comments: 0,
  thumbnailUrl: "https://img.example.com/live.jpg",
  source: "channel" as const,
  isLiveStream: true,
};

const MOCK_SCORED = MOCK_RAW_VIDEOS.map((v, i) => ({ ...v, score: 0.9 - i * 0.1 }));
const MOCK_LIVE_SCORED = [{ ...MOCK_LIVE_VIDEO, score: 0.85 }];
const MOCK_TOP3 = MOCK_SCORED.slice(0, 3);

// Default select mock: call 1 = channels, call 2+ = keywords
function setDefaultSelectMock() {
  let selectCallCount = 0;
  mockSelect.mockImplementation(() => {
    selectCallCount++;
    return selectCallCount === 1
      ? makeChannelChain(MOCK_CHANNELS)
      : makeKeywordChain(MOCK_KEYWORDS);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.YOUTUBE_API_KEY = "test-key";
  buildSupabaseMock();
  setDefaultSelectMock();

  (fetchVideosFromChannels as jest.Mock).mockResolvedValue({ videos: MOCK_RAW_VIDEOS.slice(0, 2), errors: [] });
  (fetchVideosByKeyword as jest.Mock).mockResolvedValue([MOCK_RAW_VIDEOS[2]]);
  (scoreAndMerge as jest.Mock).mockReturnValue({
    merged: [...MOCK_SCORED, ...MOCK_LIVE_SCORED],
    channelPool: MOCK_SCORED.filter((v) => v.source === "channel"),
    keywordPool: MOCK_SCORED.filter((v) => v.source === "keyword"),
  });
  // pickTopVideos call order: top10NonLive, top3Live, channelNonLive, channelLive,
  //   keywordNonLive, keywordLive, mergedNonLive, mergedLive
  (pickTopVideos as jest.Mock)
    .mockReturnValueOnce(MOCK_TOP3)         // top10NonLive (picks)
    .mockReturnValueOnce(MOCK_LIVE_SCORED)  // top3Live (picks)
    .mockReturnValue([]);                   // all 6 candidate pool calls
  (summarizeVideos as jest.Mock).mockResolvedValue(["Summary 1", "Summary 2", "Summary 3"]);
  (resolveUploadPlaylistId as jest.Mock).mockResolvedValue("UUnew");
});

afterEach(() => {
  delete process.env.YOUTUBE_API_KEY;
});

describe("runYouTubeIngest", () => {
  it("throws if YOUTUBE_API_KEY is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(runYouTubeIngest(REFERENCE_DATE)).rejects.toThrow(
      "YOUTUBE_API_KEY is not set"
    );
  });

  it("throws if channels DB query fails", async () => {
    mockSelect.mockImplementationOnce(() =>
      makeChannelChain([], { message: "DB error" })
    );
    await expect(runYouTubeIngest(REFERENCE_DATE)).rejects.toThrow("Failed to load channels");
  });

  it("returns correct date in result", async () => {
    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.date).toBe("2024-01-02");
  });

  it("returns picksInserted = 3 and livePicksInserted = 1 on success", async () => {
    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.picksInserted).toBe(3);
    expect(result.livePicksInserted).toBe(1);
  });

  it("includes keyword errors in result.errors (non-fatal)", async () => {
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1
        ? makeChannelChain(MOCK_CHANNELS)
        : makeKeywordChain([], { message: "kw DB error" });
    });

    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.errors.some((e) => e.includes("kw DB error"))).toBe(true);
  });

  it("resolves missing upload_playlist_ids and caches them", async () => {
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      return selectCallCount === 1
        ? makeChannelChain([{ channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: null }])
        : makeKeywordChain(MOCK_KEYWORDS);
    });

    await runYouTubeIngest(REFERENCE_DATE);
    expect(resolveUploadPlaylistId).toHaveBeenCalledWith("UC1", "test-key");
  });

  it("records upsert error in result.errors", async () => {
    (pickTopVideos as jest.Mock)
      .mockReturnValueOnce(MOCK_TOP3)
      .mockReturnValueOnce(MOCK_LIVE_SCORED)
      .mockReturnValue([]);
    mockUpsert.mockResolvedValue({ error: { message: "upsert failed" } });
    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.picksInserted).toBe(0);
    expect(result.livePicksInserted).toBe(0);
    expect(result.errors.some((e) => e.includes("upsert failed"))).toBe(true);
  });

  it("reports candidatesFound correctly", async () => {
    const result = await runYouTubeIngest(REFERENCE_DATE);
    // 2 from channels + 1 from keywords = 3
    expect(result.candidatesFound).toBe(3);
  });
});
