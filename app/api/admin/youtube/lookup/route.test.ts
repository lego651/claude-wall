import { GET, parseYouTubeInput, suggestCategory } from "./route";

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, YOUTUBE_API_KEY: "test-key" };
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

// --- parseYouTubeInput ---

describe("parseYouTubeInput", () => {
  it("parses @handle URL", () => {
    expect(parseYouTubeInput("https://www.youtube.com/@andrewnfx")).toEqual({
      type: "handle",
      value: "andrewnfx",
    });
  });

  it("parses /channel/UCxxxx URL", () => {
    expect(parseYouTubeInput("https://www.youtube.com/channel/UCkgCjFPlUbOLPxMGLQlNS5w")).toEqual({
      type: "channelId",
      value: "UCkgCjFPlUbOLPxMGLQlNS5w",
    });
  });

  it("parses /user/name URL", () => {
    expect(parseYouTubeInput("https://www.youtube.com/user/rayner")).toEqual({
      type: "username",
      value: "rayner",
    });
  });

  it("parses /c/name URL as handle", () => {
    expect(parseYouTubeInput("https://www.youtube.com/c/somechannel")).toEqual({
      type: "handle",
      value: "somechannel",
    });
  });

  it("parses bare @handle", () => {
    expect(parseYouTubeInput("@andrewnfx")).toEqual({ type: "handle", value: "andrewnfx" });
  });

  it("parses bare channel ID", () => {
    expect(parseYouTubeInput("UCkgCjFPlUbOLPxMGLQlNS5w")).toEqual({
      type: "channelId",
      value: "UCkgCjFPlUbOLPxMGLQlNS5w",
    });
  });

  it("returns null for unrecognised input", () => {
    expect(parseYouTubeInput("not-a-url")).toBeNull();
    expect(parseYouTubeInput("")).toBeNull();
  });
});

// --- suggestCategory ---

describe("suggestCategory", () => {
  it("suggests prop_firm_review when review + prop signals present", () => {
    expect(suggestCategory("Prop Firm Reviews", "We review funded prop firms")).toBe(
      "prop_firm_review"
    );
  });

  it("suggests industry_news for news channels", () => {
    expect(suggestCategory("Bloomberg Markets", "financial news and market analysis")).toBe(
      "industry_news"
    );
  });

  it("suggests prop_firm_official for known firm names", () => {
    expect(suggestCategory("FTMO", "We fund traders with our challenge")).toBe(
      "prop_firm_official"
    );
  });

  it("defaults to trading_educator", () => {
    expect(suggestCategory("Andrew FX", "trading strategies and forex tips")).toBe(
      "trading_educator"
    );
  });
});

// --- GET handler ---

function makeYtResponse(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "UCtest123",
        snippet: {
          title: "Andrew FX",
          description: "Forex trading tips",
          thumbnails: { medium: { url: "https://thumb.jpg" } },
        },
        statistics: { subscriberCount: "50000" },
        ...overrides,
      },
    ],
  };
}

function mockFetch(body: unknown, ok = true, status = 200) {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response);
}

function makeReq(url: string) {
  return new Request(`http://localhost/api/admin/youtube/lookup?url=${encodeURIComponent(url)}`);
}

describe("GET /api/admin/youtube/lookup", () => {
  it("returns 400 if url param missing", async () => {
    const req = new Request("http://localhost/api/admin/youtube/lookup");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 500 if YOUTUBE_API_KEY missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const req = makeReq("https://www.youtube.com/@test");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 for invalid URL", async () => {
    const req = makeReq("not-valid");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 502 if YouTube API fails", async () => {
    mockFetch({}, false, 403);
    const req = makeReq("https://www.youtube.com/@andrewnfx");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  it("returns 404 if channel not found", async () => {
    mockFetch({ items: [] });
    const req = makeReq("https://www.youtube.com/@andrewnfx");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns channel data with suggested category", async () => {
    mockFetch(makeYtResponse());
    const req = makeReq("https://www.youtube.com/@andrewnfx");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel_id).toBe("UCtest123");
    expect(body.channel_name).toBe("Andrew FX");
    expect(body.thumbnail).toBe("https://thumb.jpg");
    expect(body.subscriber_count).toBe(50000);
    expect(body.suggested_category).toBe("trading_educator");
  });

  it("uses forHandle param for @handle URLs", async () => {
    const spy = mockFetch(makeYtResponse()) as jest.SpyInstance;
    const req = makeReq("https://www.youtube.com/@andrewnfx");
    await GET(req);
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("forHandle=andrewnfx");
  });

  it("uses id param for channel ID URLs", async () => {
    mockFetch(makeYtResponse());
    const req = makeReq("https://www.youtube.com/channel/UCkgCjFPlUbOLPxMGLQlNS5w");
    await GET(req);
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain("id=UCkgCjFPlUbOLPxMGLQlNS5w");
  });

  it("returns 500 on thrown error", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));
    const req = makeReq("https://www.youtube.com/@test");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
