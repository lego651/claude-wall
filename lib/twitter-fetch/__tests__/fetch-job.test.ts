/**
 * Tests for Twitter fetch job (S8-TW-003)
 * Mocks runTwitterSearch; asserts merged list, dedupe, firmId/source tags.
 */

jest.mock("@/lib/apify/twitter-scraper", () => ({
  runTwitterSearch: jest.fn(),
}));

import { runTwitterSearch } from "@/lib/apify/twitter-scraper";
import { runTwitterFetchJob } from "@/lib/twitter-fetch/fetch-job";

const mockRunTwitterSearch = runTwitterSearch as jest.MockedFunction<typeof runTwitterSearch>;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.APIFY_TOKEN = "test-token";
});

describe("runTwitterFetchJob", () => {
  it("returns merged firm and industry tweets with no duplicate ids", async () => {
    mockRunTwitterSearch
      .mockResolvedValueOnce([
        {
          id: "1",
          text: "FundingPips news",
          url: "https://x.com/a/1",
          authorUsername: "a",
          createdAt: "2024-01-15T12:00:00.000Z",
        },
        {
          id: "2",
          text: "Funded Next payout",
          url: "https://x.com/b/2",
          authorUsername: "b",
          createdAt: "2024-01-15T13:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "3",
          text: "Alpha Capital update",
          url: "https://x.com/c/3",
          authorUsername: "c",
          createdAt: "2024-01-15T14:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "4",
          text: "Prop firm regulation",
          url: "https://x.com/d/4",
          authorUsername: "d",
          createdAt: "2024-01-15T15:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "5",
          text: "Industry tweet",
          url: "https://x.com/e/5",
          authorUsername: "e",
          createdAt: "2024-01-15T16:00:00.000Z",
        },
      ]);

    const result = await runTwitterFetchJob();

    expect(mockRunTwitterSearch).toHaveBeenCalledTimes(4); // 3 firms + 1 industry
    expect(result).toHaveLength(5);
    const ids = result.map((t) => t.tweetId);
    expect(new Set(ids).size).toBe(5);

    const firmTweets = result.filter((t) => t.source === "firm");
    expect(firmTweets.length).toBe(4);
    expect(firmTweets.map((t) => t.firmId)).toEqual(
      expect.arrayContaining(["fundednext", "fundingpips", "alphacapitalgroup"])
    );

    const industryTweets = result.filter((t) => t.source === "industry");
    expect(industryTweets.length).toBe(1);
    expect(industryTweets[0].firmId).toBeUndefined();
    expect(industryTweets[0].tweetId).toBe("5");

    for (const t of result) {
      expect(t).toMatchObject({
        tweetId: expect.any(String),
        text: expect.any(String),
        url: expect.any(String),
        author: expect.any(String),
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        source: expect.stringMatching(/^firm|industry$/),
      });
    }
  });

  it("dedupes by tweet id across runs", async () => {
    mockRunTwitterSearch
      .mockResolvedValueOnce([
        { id: "1", text: "A", url: "https://x.com/1", authorUsername: "u", createdAt: "2024-01-01T00:00:00.000Z" },
      ])
      .mockResolvedValueOnce([
        { id: "1", text: "A again", url: "https://x.com/1", authorUsername: "u", createdAt: "2024-01-01T00:00:00.000Z" },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await runTwitterFetchJob();
    expect(result.filter((t) => t.tweetId === "1")).toHaveLength(1);
  });

  it("respects TWITTER_MAX_ITEMS_PER_FIRM env", async () => {
    process.env.TWITTER_MAX_ITEMS_PER_FIRM = "2";
    mockRunTwitterSearch.mockImplementation(async (opts) => {
      const max = opts.maxItemsTotal ?? 150;
      return Array.from({ length: 5 }, (_, i) => ({
        id: `id-${i}`,
        text: `t${i}`,
        url: `https://x.com/u/${i}`,
        authorUsername: "u",
        createdAt: "2024-01-01T00:00:00.000Z",
      })).slice(0, max);
    });

    const result = await runTwitterFetchJob();
    const firmTweets = result.filter((t) => t.source === "firm");
    expect(firmTweets.length).toBeLessThanOrEqual(3 * 2 + 10); // 3 firms * 2 + industry; runTwitterSearch caps at maxItemsTotal per call
    expect(mockRunTwitterSearch).toHaveBeenCalledWith(
      expect.objectContaining({ maxItemsTotal: 2 })
    );
  });

  it("uses fallback when TWITTER_MAX_ITEMS_INDUSTRY is invalid (NaN)", async () => {
    process.env.TWITTER_MAX_ITEMS_INDUSTRY = "not-a-number";
    mockRunTwitterSearch.mockResolvedValue([]);
    await runTwitterFetchJob();
    const industryCall = mockRunTwitterSearch.mock.calls.find(
      (c) => c[0].searchTerms && c[0].searchTerms.length > 5
    );
    expect(industryCall).toBeDefined();
    expect(industryCall![0].maxItemsTotal).toBe(100); // TWITTER_MAX_ITEMS_INDUSTRY default
  });

  it("uses fallback when env is empty string", async () => {
    process.env.TWITTER_MAX_ITEMS_PER_TERM = "";
    mockRunTwitterSearch.mockResolvedValue([]);
    await runTwitterFetchJob();
    expect(mockRunTwitterSearch).toHaveBeenCalledWith(
      expect.objectContaining({ maxItemsPerTerm: 50 })
    ); // config default
  });

  it("clamps negative env to 0", async () => {
    process.env.TWITTER_MAX_ITEMS_PER_FIRM = "-5";
    mockRunTwitterSearch.mockResolvedValue([]);
    await runTwitterFetchJob();
    expect(mockRunTwitterSearch).toHaveBeenCalledWith(
      expect.objectContaining({ maxItemsTotal: 0 })
    );
  });
});
