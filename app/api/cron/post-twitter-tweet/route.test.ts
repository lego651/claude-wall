import { GET } from "./route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

const mockPostTweet = jest.fn();
jest.mock("@/lib/twitter-bot/client", () => ({
  postTweet: (...args: unknown[]) => mockPostTweet(...args),
}));

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({}) },
  })),
}));

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/post-twitter-tweet", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function chainMock(returns: object) {
  const obj: Record<string, unknown> = {};
  const methods = ["select", "eq", "or", "maybeSingle", "update"];
  for (const m of methods) {
    obj[m] = jest.fn().mockReturnValue(obj);
  }
  Object.assign(obj, returns);
  return obj;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CRON_SECRET;
  process.env.RESEND_API_KEY = "re_test";
  process.env.ADMIN_EMAIL = "admin@test.com";
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.ADMIN_EMAIL;
});

describe("GET /api/cron/post-twitter-tweet", () => {
  it("returns 401 when CRON_SECRET is set and header is wrong", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with skipped=true when no draft found for today", async () => {
    const chain = chainMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(json.success).toBe(false);
  });

  it("posts the tweet and marks status as posted on success", async () => {
    const draft = {
      id: "draft-1",
      tweet_text: "Great video today!\n\n#PropTrading",
      status: "approved",
      auto_approve: false,
      template: "B",
      creator_handle: null,
    };
    const getDraft = chainMock({ data: draft, error: null });
    const updateChain = chainMock({ error: null });
    mockFrom
      .mockReturnValueOnce(getDraft)
      .mockReturnValueOnce(updateChain);

    mockPostTweet.mockResolvedValueOnce({ tweetId: "tweet-xyz" });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tweetId).toBe("tweet-xyz");
  });

  it("marks draft as failed and returns 500 when posting fails", async () => {
    const draft = {
      id: "draft-2",
      tweet_text: "Some tweet text",
      status: "approved",
      auto_approve: false,
      template: "A",
      creator_handle: "someone",
    };
    const getDraft = chainMock({ data: draft, error: null });
    const updateChain = chainMock({ error: null });
    mockFrom
      .mockReturnValueOnce(getDraft)
      .mockReturnValueOnce(updateChain);

    mockPostTweet.mockRejectedValueOnce(new Error("API error: 429"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("API error");
  });

  it("posts auto-approved drafts without manual approval", async () => {
    const draft = {
      id: "draft-3",
      tweet_text: "Auto approved tweet",
      status: "pending",
      auto_approve: true,
      template: "B",
      creator_handle: null,
    };
    const getDraft = chainMock({ data: draft, error: null });
    const updateChain = chainMock({ error: null });
    mockFrom
      .mockReturnValueOnce(getDraft)
      .mockReturnValueOnce(updateChain);

    mockPostTweet.mockResolvedValueOnce({ tweetId: "auto-tweet-1" });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.tweetId).toBe("auto-tweet-1");
  });
});
