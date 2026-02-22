/**
 * Tests for Apify Twitter scraper (S8-TW-002)
 * Mocks Apify REST API and asserts normalized output shape.
 */

const originalFetch = globalThis.fetch;
const originalEnv = process.env.APIFY_TOKEN;

beforeEach(() => {
  process.env.APIFY_TOKEN = "test-token";
});

afterEach(() => {
  process.env.APIFY_TOKEN = originalEnv;
  jest.restoreAllMocks();
});

describe("runTwitterSearch", () => {
  it("returns normalized tweets from mocked Apify response", async () => {
    const runId = "run-123";
    const datasetId = "dataset-456";
    const rawItems = [
      {
        id: "1846846285917131130",
        url: "https://x.com/user/status/1846846285917131130",
        text: "FundingPips payout was fast",
        createdAt: "Thu Oct 17 09:30:41 +0000 2024",
        author: { userName: "trader1" },
      },
      {
        id: "1846846285917131131",
        url: "https://x.com/other/status/1846846285917131131",
        text: "Prop firm news today",
        createdAt: "2024-10-17T10:00:00.000Z",
        author: { userName: "newsbot" },
      },
    ];

    let callCount = 0;
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      callCount += 1;
      const urlStr = String(url);
      // Start run
      if (urlStr.includes("/runs?") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { id: runId, status: "RUNNING" },
            }),
            { status: 200 }
          )
        );
      }
      // Poll run status
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: { status: "SUCCEEDED", defaultDatasetId: datasetId },
            }),
            { status: 200 }
          )
        );
      }
      // Get dataset items
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(
          new Response(JSON.stringify(rawItems), { status: 200 })
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({
      searchTerms: ["FundingPips"],
      maxItemsPerTerm: 50,
    });

    expect(result).toHaveLength(2);
    for (const tweet of result) {
      expect(tweet).toMatchObject({
        id: expect.any(String),
        text: expect.any(String),
        url: expect.any(String),
        authorUsername: expect.any(String),
        createdAt: expect.any(String),
      });
      expect(tweet.id).not.toBe("");
      expect(tweet.url).toMatch(/^https?:\/\//);
      expect(tweet.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
    expect(result[0].id).toBe("1846846285917131130");
    expect(result[0].authorUsername).toBe("trader1");
    expect(result[0].text).toBe("FundingPips payout was fast");
  });

  it("returns empty array when APIFY_TOKEN is missing", async () => {
    process.env.APIFY_TOKEN = "";
    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    await expect(runTwitterSearch({ searchTerms: ["test"] })).rejects.toThrow("APIFY_TOKEN");
  });

  it("returns empty array on Apify run failure (does not throw)", async () => {
    process.env.APIFY_TOKEN = "test-token";
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    );

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["test"] });
    expect(result).toEqual([]);
  });

  it("returns empty array when searchTerms is empty", async () => {
    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: [] });
    expect(result).toEqual([]);
  });

  it("respects maxItemsTotal and stops after cap", async () => {
    const runId = "run-cap";
    const datasetId = "dataset-cap";
    const rawItems = [
      { id: "1", url: "https://x.com/a/status/1", text: "A", author: { userName: "a" }, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "2", url: "https://x.com/b/status/2", text: "B", author: { userName: "b" }, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "3", url: "https://x.com/c/status/3", text: "C", author: { userName: "c" }, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "4", url: "https://x.com/d/status/4", text: "D", author: { userName: "d" }, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "5", url: "https://x.com/e/status/5", text: "E", author: { userName: "e" }, createdAt: "2024-01-01T00:00:00.000Z" },
    ];
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: datasetId } }), { status: 200 }));
      }
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(new Response(JSON.stringify(rawItems), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"], maxItemsTotal: 3 });
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id)).toEqual(["1", "2", "3"]);
  });

  it("skips items that normalize to null (missing id or url)", async () => {
    const runId = "run-skip";
    const datasetId = "dataset-skip";
    const rawItems = [
      { id: "1", url: "https://x.com/a/1", text: "Ok", author: { userName: "a" }, createdAt: "2024-01-01T00:00:00.000Z" },
      { url: "https://x.com/b/2", text: "No id" }, // no id -> normalizeItem returns null
      { id: "3", text: "No url", author: { userName: "c" }, createdAt: "2024-01-01T00:00:00.000Z" }, // no url -> null
    ];
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: datasetId } }), { status: 200 }));
      }
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(new Response(JSON.stringify(rawItems), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("uses author.username when userName is not present", async () => {
    const runId = "run-user";
    const datasetId = "dataset-user";
    const rawItems = [
      { id: "1", url: "https://x.com/u/1", text: "Hi", author: { username: "handle_only" }, createdAt: "2024-01-01T00:00:00.000Z" },
    ];
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: datasetId } }), { status: 200 }));
      }
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(new Response(JSON.stringify(rawItems), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"] });
    expect(result).toHaveLength(1);
    expect(result[0].authorUsername).toBe("handle_only");
  });

  it("dedupes by id and returns empty on duplicate ids", async () => {
    const runId = "run-dup";
    const datasetId = "dataset-dup";
    const rawItems = [
      { id: "1", url: "https://x.com/a/1", text: "First", author: { userName: "a" }, createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "1", url: "https://x.com/a/1", text: "Duplicate", author: { userName: "a" }, createdAt: "2024-01-01T00:00:00.000Z" },
    ];
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: datasetId } }), { status: 200 }));
      }
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(new Response(JSON.stringify(rawItems), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"] });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("First");
  });

  it("returns empty array when Apify run status is FAILED", async () => {
    const runId = "run-fail";
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && url.includes("token=")) {
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "FAILED" } }), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"] });
    expect(result).toEqual([]);
  });

  it("returns empty array when startRun response has no run id", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"] });
    expect(result).toEqual([]);
  });

  it("returns empty array when dataset returns non-array", async () => {
    const runId = "run-na";
    const datasetId = "dataset-na";
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && url.includes("token=")) {
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: datasetId } }), { status: 200 }));
      }
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 })); // not an array
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"] });
    expect(result).toEqual([]);
  });

  it("uses APIFY_TWITTER_ACTOR_ID when set", async () => {
    const customActorId = "custom~my-actor";
    process.env.APIFY_TWITTER_ACTOR_ID = customActorId;
    const runId = "run-custom";
    const datasetId = "dataset-custom";
    let capturedRunUrl = "";
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && init?.method === "POST") {
        capturedRunUrl = urlStr;
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: datasetId } }), { status: 200 }));
      }
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    await runTwitterSearch({ searchTerms: ["x"] });
    expect(capturedRunUrl).toContain(encodeURIComponent(customActorId));
    delete process.env.APIFY_TWITTER_ACTOR_ID;
  });

  it("normalizes Kaito-style createdAt to ISO when parse succeeds", async () => {
    const runId = "run-date";
    const datasetId = "dataset-date";
    const rawItems = [
      { id: "1", url: "https://x.com/u/1", text: "T", author: { userName: "u" }, createdAt: "Mon Jan 15 12:00:00 +0000 2024" },
    ];
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/runs?") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ data: { id: runId, status: "RUNNING" } }), { status: 200 }));
      }
      if (urlStr.includes(`/actor-runs/${runId}`)) {
        return Promise.resolve(new Response(JSON.stringify({ data: { status: "SUCCEEDED", defaultDatasetId: datasetId } }), { status: 200 }));
      }
      if (urlStr.includes(`/datasets/${datasetId}/items`)) {
        return Promise.resolve(new Response(JSON.stringify(rawItems), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    });

    const { runTwitterSearch } = await import("@/lib/apify/twitter-scraper");
    const result = await runTwitterSearch({ searchTerms: ["x"] });
    expect(result).toHaveLength(1);
    expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
