import { GET } from "./route";
import { NextResponse } from "next/server";

// Mock Supabase service client
const mockFrom = jest.fn();
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

// Mock tweet generator
const mockGenerateTweetDraft = jest.fn();
jest.mock("@/lib/twitter-bot/generate-tweet", () => ({
  generateTweetDraft: (...args: unknown[]) => mockGenerateTweetDraft(...args),
}));

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/generate-twitter-draft", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function chainMock(returns: object) {
  const obj: Record<string, unknown> = {};
  const methods = ["select", "eq", "or", "maybeSingle", "limit", "insert", "update", "single"];
  for (const m of methods) {
    obj[m] = jest.fn().mockReturnValue(obj);
  }
  Object.assign(obj, returns);
  return obj;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/generate-twitter-draft", () => {
  it("returns 401 when CRON_SECRET is set and header is missing", async () => {
    process.env.CRON_SECRET = "secret123";
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("passes auth when CRON_SECRET matches", async () => {
    process.env.CRON_SECRET = "secret123";

    // existing draft → skipped
    const chain = chainMock({ data: { id: "existing", status: "approved" }, error: null });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeRequest("Bearer secret123"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
  });

  it("skips if draft already exists for tomorrow", async () => {
    const chain = chainMock({ data: { id: "draft-1", status: "pending" }, error: null });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(json.success).toBe(true);
  });

  it("returns 422 if no YouTube picks exist for today", async () => {
    const noDraft = chainMock({ data: null, error: null });
    const noPicks = chainMock({ data: [], error: null });
    mockFrom
      .mockReturnValueOnce(noDraft)
      .mockReturnValueOnce(noPicks);
    // No more from() calls expected after empty picks

    const res = await GET(makeRequest());
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toMatch(/No YouTube picks/);
  });

  it("returns 500 if picks query errors", async () => {
    const noDraft = chainMock({ data: null, error: null });
    const pickErr = chainMock({ data: null, error: { message: "DB down" } });
    mockFrom
      .mockReturnValueOnce(noDraft)
      .mockReturnValueOnce(pickErr);

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("generates and inserts a draft when picks are found", async () => {
    const pick = {
      rank: 1, video_id: "v1", title: "Test Video", channel_name: "TestChan",
      channel_id: "ch1", video_url: "https://youtube.com/watch?v=v1",
      ai_summary: "A great video.",
    };

    const noDraft = chainMock({ data: null, error: null });
    const picksResult = chainMock({ data: [pick], error: null });
    const channelResult = chainMock({ data: { twitter_handle: "testchan" }, error: null });
    const insertResult = chainMock({ error: null });
    mockFrom
      .mockReturnValueOnce(noDraft)
      .mockReturnValueOnce(picksResult)
      .mockReturnValueOnce(channelResult)
      .mockReturnValueOnce(insertResult);

    mockGenerateTweetDraft.mockResolvedValueOnce({
      tweetText: "Hook\n\nSummary\n\nVia @testchan 📺 https://youtube.com/watch?v=v1\n\nMore: https://propfirmhub.com/news?utm_source=twitter\n\n#PropTrading",
      template: "A",
      creatorHandle: "testchan",
      videoTitle: "Test Video",
      videoUrl: "https://youtube.com/watch?v=v1",
      newsUrl: "https://propfirmhub.com/news?utm_source=twitter",
      charCount: 180,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.template).toBe("A");
    expect(json.creatorHandle).toBe("testchan");
  });
});
