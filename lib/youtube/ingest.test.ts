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
import { scoreVideos, pickTopVideos } from "./score-videos";
import { summarizeVideos } from "./summarize-video";

const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockUpsert = jest.fn();

function buildSupabaseMock() {
  mockEq.mockReturnThis();
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockUpsert.mockResolvedValue({ error: null });

  // Chain: from → select → eq → resolves
  mockFrom.mockImplementation((table: string) => {
    return {
      select: mockSelect,
      update: mockUpdate,
      upsert: mockUpsert,
    };
  });

  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
}

const REFERENCE_DATE = new Date("2024-01-02T10:00:00Z");

const MOCK_CHANNELS = [
  { channel_id: "UC1", channel_name: "Channel 1", upload_playlist_id: "UU1" },
];
const MOCK_KEYWORDS = [{ keyword: "prop firm" }];

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
  },
];

const MOCK_SCORED = MOCK_RAW_VIDEOS.map((v, i) => ({ ...v, score: 0.9 - i * 0.1 }));
const MOCK_TOP3 = MOCK_SCORED.slice(0, 3);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.YOUTUBE_API_KEY = "test-key";
  buildSupabaseMock();

  // Default DB responses
  mockSelect.mockImplementation(() => ({
    eq: jest.fn().mockImplementation(() => ({
      // channel query returns channels, keyword query returns keywords
      then: undefined,
    })),
  }));

  // Patch select to return appropriate data based on call order
  let selectCallCount = 0;
  mockSelect.mockImplementation(() => {
    selectCallCount++;
    const data = selectCallCount === 1 ? MOCK_CHANNELS : MOCK_KEYWORDS;
    return {
      eq: jest.fn().mockResolvedValue({ data, error: null }),
    };
  });

  (fetchVideosFromChannels as jest.Mock).mockResolvedValue(MOCK_RAW_VIDEOS.slice(0, 2));
  (fetchVideosByKeyword as jest.Mock).mockResolvedValue([MOCK_RAW_VIDEOS[2]]);
  (scoreVideos as jest.Mock).mockReturnValue(MOCK_SCORED);
  (pickTopVideos as jest.Mock).mockReturnValue(MOCK_TOP3);
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
    mockSelect.mockImplementationOnce(() => ({
      eq: jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    }));
    await expect(runYouTubeIngest(REFERENCE_DATE)).rejects.toThrow("Failed to load channels");
  });

  it("returns correct date in result", async () => {
    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.date).toBe("2024-01-02");
  });

  it("returns picksInserted = 3 on success", async () => {
    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.picksInserted).toBe(3);
  });

  it("includes keyword errors in result.errors (non-fatal)", async () => {
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      const data = selectCallCount === 1 ? MOCK_CHANNELS : MOCK_KEYWORDS;
      const error = selectCallCount === 2 ? { message: "kw DB error" } : null;
      return {
        eq: jest.fn().mockResolvedValue({ data, error }),
      };
    });

    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.errors.some((e) => e.includes("kw DB error"))).toBe(true);
  });

  it("resolves missing upload_playlist_ids and caches them", async () => {
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      const data =
        selectCallCount === 1
          ? [{ channel_id: "UC1", channel_name: "Ch1", upload_playlist_id: null }]
          : MOCK_KEYWORDS;
      return {
        eq: jest.fn().mockResolvedValue({ data, error: null }),
      };
    });

    await runYouTubeIngest(REFERENCE_DATE);
    expect(resolveUploadPlaylistId).toHaveBeenCalledWith("UC1", "test-key");
  });

  it("records upsert error in result.errors", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "upsert failed" } });
    const result = await runYouTubeIngest(REFERENCE_DATE);
    expect(result.picksInserted).toBe(0);
    expect(result.errors.some((e) => e.includes("upsert failed"))).toBe(true);
  });

  it("reports candidatesFound correctly", async () => {
    const result = await runYouTubeIngest(REFERENCE_DATE);
    // 2 from channels + 1 from keywords = 3
    expect(result.candidatesFound).toBe(3);
  });
});
