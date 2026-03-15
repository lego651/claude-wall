import { GET } from "./route";

const MOCK_API_KEY = "test-api-key";

beforeEach(() => {
  jest.resetAllMocks();
  process.env.YOUTUBE_API_KEY = MOCK_API_KEY;
});

afterEach(() => {
  delete process.env.YOUTUBE_API_KEY;
});

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/youtube/search-channel");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

const MOCK_ITEMS = [
  {
    snippet: {
      channelId: "UCabc123",
      channelTitle: "FTMO Official",
      description: "FTMO is a leading prop trading firm.",
      thumbnails: { default: { url: "https://example.com/thumb.jpg" } },
    },
  },
  {
    snippet: {
      channelId: "UCdef456",
      channelTitle: "FTMO Review Channel",
      description: "We review FTMO.",
      thumbnails: { default: { url: "https://example.com/thumb2.jpg" } },
    },
  },
];

describe("GET /api/admin/youtube/search-channel", () => {
  it("returns 400 if name param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 500 if YOUTUBE_API_KEY is not set", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const res = await GET(makeRequest({ name: "FTMO" }));
    expect(res.status).toBe(500);
  });

  it("returns mapped channels on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: MOCK_ITEMS }),
    } as Response);

    const res = await GET(makeRequest({ name: "FTMO" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(2);
    expect(body.channels[0]).toMatchObject({
      channel_id: "UCabc123",
      channel_name: "FTMO Official",
    });
  });

  it("filters out items with empty channel_id", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ snippet: { channelId: "", channelTitle: "Empty" } }],
      }),
    } as Response);

    const res = await GET(makeRequest({ name: "FTMO" }));
    const body = await res.json();
    expect(body.channels).toHaveLength(0);
  });

  it("returns 502 on YouTube API error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "quota exceeded" } }),
    } as Response);

    const res = await GET(makeRequest({ name: "FTMO" }));
    expect(res.status).toBe(502);
  });

  it("returns 500 on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network failure"));

    const res = await GET(makeRequest({ name: "FTMO" }));
    expect(res.status).toBe(500);
  });

  it("truncates description to 200 chars", async () => {
    const longDesc = "x".repeat(300);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            snippet: {
              channelId: "UCabc",
              channelTitle: "Test",
              description: longDesc,
              thumbnails: { default: { url: "" } },
            },
          },
        ],
      }),
    } as Response);

    const res = await GET(makeRequest({ name: "Test" }));
    const body = await res.json();
    expect(body.channels[0].description).toHaveLength(200);
  });
});
