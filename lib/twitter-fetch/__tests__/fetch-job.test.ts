/**
 * Tests for Twitter fetch job — hybrid 2-run model (S10-011)
 * Mocks runTwitterSearch; asserts 2 Apify runs, handle attribution, dedupe, source tags.
 */

jest.mock("@/lib/apify/twitter-scraper", () => ({
  runTwitterSearch: jest.fn(),
}));

import { runTwitterSearch } from "@/lib/apify/twitter-scraper";
import { runTwitterFetchJob } from "@/lib/twitter-fetch/fetch-job";

const mockRunTwitterSearch = runTwitterSearch as jest.MockedFunction<typeof runTwitterSearch>;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.TWITTER_MAX_ITEMS_PER_FIRM;
  delete process.env.TWITTER_MAX_ITEMS_INDUSTRY;
  process.env.APIFY_TOKEN = "test-token";
});

describe("runTwitterFetchJob — hybrid 2-run model", () => {
  it("makes exactly 2 Apify calls: one firm official run and one industry run", async () => {
    mockRunTwitterSearch.mockResolvedValue([]);

    await runTwitterFetchJob();

    expect(mockRunTwitterSearch).toHaveBeenCalledTimes(2);
  });

  it("passes combined from: query as a single search term in Run 1", async () => {
    mockRunTwitterSearch.mockResolvedValue([]);

    await runTwitterFetchJob();

    const [run1Call] = mockRunTwitterSearch.mock.calls;
    const searchTerms = run1Call[0].searchTerms;
    expect(searchTerms).toHaveLength(1);
    expect(searchTerms[0]).toMatch(/from:FundedNext/);
    expect(searchTerms[0]).toMatch(/from:FundingPips/);
    expect(searchTerms[0]).toMatch(/from:AlphaCapitalGroup/);
    expect(searchTerms[0]).toMatch(/ OR /);
  });

  it("attributes firm_official tweets by matching authorUsername to firmId", async () => {
    mockRunTwitterSearch
      .mockResolvedValueOnce([
        {
          id: "1",
          text: "FundedNext update",
          url: "https://x.com/FundedNext/1",
          authorUsername: "FundedNext", // case matches handle
          createdAt: "2024-01-15T12:00:00.000Z",
        },
        {
          id: "2",
          text: "FundingPips update",
          url: "https://x.com/FundingPips/2",
          authorUsername: "fundingpips", // lowercase — should still match
          createdAt: "2024-01-15T13:00:00.000Z",
        },
        {
          id: "3",
          text: "Unknown author tweet",
          url: "https://x.com/unknown/3",
          authorUsername: "SomeRandomUser", // no match
          createdAt: "2024-01-15T14:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([]); // industry

    const result = await runTwitterFetchJob();

    const t1 = result.find((t) => t.tweetId === "1");
    expect(t1?.firmId).toBe("fundednext");
    expect(t1?.source).toBe("firm_official");

    const t2 = result.find((t) => t.tweetId === "2");
    expect(t2?.firmId).toBe("fundingpips");
    expect(t2?.source).toBe("firm_official");

    // Unmatched author — no firmId but still included
    const t3 = result.find((t) => t.tweetId === "3");
    expect(t3?.firmId).toBeUndefined();
    expect(t3?.source).toBe("firm_official");
  });

  it("tags industry tweets with source industry and no firmId", async () => {
    mockRunTwitterSearch
      .mockResolvedValueOnce([]) // firm run
      .mockResolvedValueOnce([
        {
          id: "10",
          text: "Industry news",
          url: "https://x.com/someone/10",
          authorUsername: "someone",
          createdAt: "2024-01-15T16:00:00.000Z",
        },
      ]);

    const result = await runTwitterFetchJob();

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("industry");
    expect(result[0].firmId).toBeUndefined();
    expect(result[0].tweetId).toBe("10");
  });

  it("dedupes by tweet id across both runs", async () => {
    mockRunTwitterSearch
      .mockResolvedValueOnce([
        { id: "dup", text: "From firm run", url: "https://x.com/1", authorUsername: "FundedNext", createdAt: "2024-01-01T00:00:00.000Z" },
      ])
      .mockResolvedValueOnce([
        { id: "dup", text: "Same from industry", url: "https://x.com/1", authorUsername: "FundedNext", createdAt: "2024-01-01T00:00:00.000Z" },
      ]);

    const result = await runTwitterFetchJob();

    expect(result.filter((t) => t.tweetId === "dup")).toHaveLength(1);
    expect(result[0].source).toBe("firm_official"); // firm run wins (first seen)
  });

  it("returns merged results from both runs with correct counts", async () => {
    mockRunTwitterSearch
      .mockResolvedValueOnce([
        { id: "a", text: "Firm A", url: "https://x.com/a", authorUsername: "FundedNext", createdAt: "2024-01-15T12:00:00.000Z" },
        { id: "b", text: "Firm B", url: "https://x.com/b", authorUsername: "FundingPips", createdAt: "2024-01-15T13:00:00.000Z" },
      ])
      .mockResolvedValueOnce([
        { id: "c", text: "Industry C", url: "https://x.com/c", authorUsername: "trader", createdAt: "2024-01-15T14:00:00.000Z" },
      ]);

    const result = await runTwitterFetchJob();

    expect(result).toHaveLength(3);
    expect(result.filter((t) => t.source === "firm_official")).toHaveLength(2);
    expect(result.filter((t) => t.source === "industry")).toHaveLength(1);
  });

  it("uses TWITTER_MAX_ITEMS_PER_FIRM env as per-handle cap; combined total = cap * handle count", async () => {
    process.env.TWITTER_MAX_ITEMS_PER_FIRM = "10";
    mockRunTwitterSearch.mockResolvedValue([]);

    await runTwitterFetchJob();

    const [run1Call] = mockRunTwitterSearch.mock.calls;
    // 3 firm handles * 10 per handle = 30
    expect(run1Call[0].maxItemsTotal).toBe(30);
  });

  it("uses TWITTER_MAX_ITEMS_INDUSTRY env to cap industry run", async () => {
    process.env.TWITTER_MAX_ITEMS_INDUSTRY = "25";
    mockRunTwitterSearch.mockResolvedValue([]);

    await runTwitterFetchJob();

    const [, run2Call] = mockRunTwitterSearch.mock.calls;
    expect(run2Call[0].maxItemsTotal).toBe(25);
  });

  it("uses fallback when TWITTER_MAX_ITEMS_INDUSTRY is invalid (NaN)", async () => {
    process.env.TWITTER_MAX_ITEMS_INDUSTRY = "not-a-number";
    mockRunTwitterSearch.mockResolvedValue([]);

    await runTwitterFetchJob();

    const [, run2Call] = mockRunTwitterSearch.mock.calls;
    expect(run2Call[0].maxItemsTotal).toBe(100); // TWITTER_MAX_ITEMS_INDUSTRY default
  });

  it("uses fallback when TWITTER_MAX_ITEMS_PER_FIRM is empty string", async () => {
    process.env.TWITTER_MAX_ITEMS_PER_FIRM = "";
    mockRunTwitterSearch.mockResolvedValue([]);

    await runTwitterFetchJob();

    const [run1Call] = mockRunTwitterSearch.mock.calls;
    // default is 50 per handle * 3 handles = 150
    expect(run1Call[0].maxItemsTotal).toBe(150);
  });

  it("clamps negative TWITTER_MAX_ITEMS_PER_FIRM env to 0", async () => {
    process.env.TWITTER_MAX_ITEMS_PER_FIRM = "-5";
    mockRunTwitterSearch.mockResolvedValue([]);

    await runTwitterFetchJob();

    const [run1Call] = mockRunTwitterSearch.mock.calls;
    expect(run1Call[0].maxItemsTotal).toBe(0);
  });

  it("formats date as YYYY-MM-DD from ISO createdAt", async () => {
    mockRunTwitterSearch
      .mockResolvedValueOnce([
        { id: "x", text: "T", url: "https://x.com/x", authorUsername: "FundedNext", createdAt: "2024-03-15T08:30:00.000Z" },
      ])
      .mockResolvedValueOnce([]);

    const result = await runTwitterFetchJob();

    expect(result[0].date).toBe("2024-03-15");
  });

  it("returns empty array when both runs return no tweets", async () => {
    mockRunTwitterSearch.mockResolvedValue([]);

    const result = await runTwitterFetchJob();

    expect(result).toHaveLength(0);
  });
});
