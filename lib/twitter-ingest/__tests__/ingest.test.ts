/**
 * Tests for Twitter ingest (S8-TW-004)
 * Mocks Supabase and batch categorizer; asserts dedupe and insert counts.
 */

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

jest.mock("@/lib/ai/categorize-tweets", () => ({
  categorizeTweetBatch: jest.fn(),
  TWITTER_AI_BATCH_SIZE: 20,
}));

import { createServiceClient } from "@/lib/supabase/service";
import { categorizeTweetBatch } from "@/lib/ai/categorize-tweets";
import { ingestTweets } from "../ingest";
import type { FetchedTweet } from "@/lib/twitter-fetch/fetch-job";

function createMockSupabase() {
  const insert = jest.fn().mockResolvedValue({ error: null });
  const in_ = jest.fn().mockResolvedValue({ data: [], error: null });

  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: in_,
    insert,
  };

  const from = jest.fn((_table: string) => chain);
  return { from, select: chain.select, in: in_, insert };
}

describe("ingestTweets", () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createServiceClient as jest.Mock).mockReturnValue({ from: mock.from });

    (categorizeTweetBatch as jest.Mock).mockImplementation((inputs: unknown[]) =>
      Promise.resolve(
        inputs.map(() => ({
          category: "company_news",
          summary: "Summary",
          importance_score: 0.7,
          topic_title: "Company news",
          mentioned_firm_ids: [],
        }))
      )
    );
  });

  it("returns zeros when fetched is empty", async () => {
    const result = await ingestTweets([]);
    expect(result).toEqual({
      firmInserted: 0,
      industryInserted: 0,
      firmSkipped: 0,
      industrySkipped: 0,
    });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("dedupes firm tweets and inserts only new", async () => {
    mock.in
      .mockResolvedValueOnce({
        data: [{ firm_id: "fundednext", url: "https://x.com/a/1" }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const fetched: FetchedTweet[] = [
      {
        tweetId: "1",
        text: "News",
        url: "https://x.com/a/1",
        author: "a",
        date: "2024-01-15",
        firmId: "fundednext",
        source: "firm",
      },
      {
        tweetId: "2",
        text: "Other",
        url: "https://x.com/b/2",
        author: "b",
        date: "2024-01-15",
        firmId: "fundednext",
        source: "firm",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(categorizeTweetBatch).toHaveBeenCalledTimes(1);
    expect(mock.from).toHaveBeenCalledWith("firm_twitter_tweets");
    expect(mock.insert).toHaveBeenCalledTimes(1);
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        firm_id: "fundednext",
        tweet_id: "2",
        url: "https://x.com/b/2",
        category: "company_news",
        importance_score: 0.7,
      })
    );
    expect(result.firmInserted).toBe(1);
    expect(result.firmSkipped).toBe(1);
  });

  it("inserts industry tweets into firm_twitter_tweets with firm_id industry", async () => {
    const fetched: FetchedTweet[] = [
      {
        tweetId: "5",
        text: "Industry update",
        url: "https://x.com/e/5",
        author: "e",
        date: "2024-01-16",
        source: "industry",
      },
    ];

    (categorizeTweetBatch as jest.Mock).mockResolvedValue([
      { category: "other", summary: "Industry summary", importance_score: 0.5, topic_title: "Industry update", mentioned_firm_ids: ["fundednext"] },
    ]);

    const result = await ingestTweets(fetched);

    expect(categorizeTweetBatch).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ isIndustry: true })
    );
    expect(mock.from).toHaveBeenCalledWith("firm_twitter_tweets");
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        firm_id: "industry",
        tweet_id: "5",
        url: "https://x.com/e/5",
        text: "Industry update",
        tweeted_at: "2024-01-16",
        ai_summary: "Industry summary",
        category: "other",
        importance_score: 0.5,
        topic_title: "Industry update",
        published: false,
      })
    );
    expect(result.industryInserted).toBe(1);
    expect(result.industrySkipped).toBe(0);
  });

  it("skips industry tweets whose url already exists in firm_twitter_tweets (industry)", async () => {
    // Industry dedupe: firm_twitter_tweets firm_id=industry .in('url', ...)
    mock.in.mockResolvedValueOnce({
      data: [{ url: "https://x.com/e/5" }],
      error: null,
    });

    const fetched: FetchedTweet[] = [
      {
        tweetId: "5",
        text: "Already seen",
        url: "https://x.com/e/5",
        author: "e",
        date: "2024-01-16T14:00:00.000Z",
        source: "industry",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.industryInserted).toBe(0);
    expect(result.industrySkipped).toBe(1);
    expect(categorizeTweetBatch).not.toHaveBeenCalled();
  });

  it("uses toDateOnly for tweet date and inserts firm tweet", async () => {
    const fetched: FetchedTweet[] = [
      {
        tweetId: "3",
        text: "New feature",
        url: "https://x.com/c/3",
        author: "c",
        date: "2024/01/17",
        firmId: "fundingpips",
        source: "firm",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.firmInserted).toBe(1);
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tweeted_at: "2024-01-17",
        firm_id: "fundingpips",
      })
    );
  });

  it("does not increment firmInserted when insert returns error", async () => {
    mock.insert
      .mockResolvedValueOnce({ error: { message: "db error" } })
      .mockResolvedValueOnce({ error: null });

    const fetched: FetchedTweet[] = [
      {
        tweetId: "a",
        text: "One",
        url: "https://x.com/a/1",
        author: "a",
        date: "2024-01-15",
        firmId: "fundednext",
        source: "firm",
      },
      {
        tweetId: "b",
        text: "Two",
        url: "https://x.com/b/2",
        author: "b",
        date: "2024-01-15",
        firmId: "fundednext",
        source: "firm",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.firmInserted).toBe(1);
    expect(mock.insert).toHaveBeenCalledTimes(2);
  });

  it("does not increment industryInserted when insert returns error", async () => {
    mock.insert.mockResolvedValueOnce({ error: { message: "db error" } });

    const fetched: FetchedTweet[] = [
      {
        tweetId: "5",
        text: "Industry",
        url: "https://x.com/e/5",
        author: "e",
        date: "2024-01-16",
        source: "industry",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.industryInserted).toBe(0);
  });

  it("skips firm row when batch result is missing (continue branch)", async () => {
    (categorizeTweetBatch as jest.Mock).mockResolvedValue([
      { category: "other", summary: "Only first", importance_score: 0.5, topic_title: "Other" },
      // second result missing
    ]);

    const fetched: FetchedTweet[] = [
      {
        tweetId: "x",
        text: "First",
        url: "https://x.com/x/1",
        author: "a",
        date: "2024-01-15",
        firmId: "fundednext",
        source: "firm",
      },
      {
        tweetId: "y",
        text: "Second",
        url: "https://x.com/y/2",
        author: "b",
        date: "2024-01-15",
        firmId: "fundednext",
        source: "firm",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.firmInserted).toBe(1);
    expect(mock.insert).toHaveBeenCalledTimes(1);
  });

  it("inserts industry tweet with empty text into firm_twitter_tweets", async () => {
    const fetched: FetchedTweet[] = [
      {
        tweetId: "6",
        text: "",
        url: "https://x.com/f/6",
        author: "f",
        date: "2024-01-16",
        source: "industry",
      },
    ];

    (categorizeTweetBatch as jest.Mock).mockResolvedValue([
      { category: "other", summary: "No text", importance_score: 0.3, topic_title: "Other" },
    ]);

    const result = await ingestTweets(fetched);

    expect(result.industryInserted).toBe(1);
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        firm_id: "industry",
        text: "",
        url: "https://x.com/f/6",
      })
    );
  });

  it("skips firm dedupe when select returns null data", async () => {
    mock.in.mockResolvedValueOnce({ data: null, error: null });

    const fetched: FetchedTweet[] = [
      {
        tweetId: "7",
        text: "New",
        url: "https://x.com/g/7",
        author: "g",
        date: "2024-01-15",
        firmId: "fundednext",
        source: "firm",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.firmInserted).toBe(1);
    expect(result.firmSkipped).toBe(0);
  });

  it("skips industry row when url already in firm_twitter_tweets, inserts new", async () => {
    mock.in.mockResolvedValueOnce({
      data: [{ url: "https://x.com/e/5" }, { url: null }],
      error: null,
    });

    const fetched: FetchedTweet[] = [
      {
        tweetId: "5",
        text: "Seen",
        url: "https://x.com/e/5",
        author: "e",
        date: "2024-01-16",
        source: "industry",
      },
      {
        tweetId: "8",
        text: "New industry",
        url: "https://x.com/h/8",
        author: "h",
        date: "2024-01-16",
        source: "industry",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.industrySkipped).toBe(1);
    expect(result.industryInserted).toBe(1);
  });

  it("treats industry dedupe null data as no existing urls (branch coverage)", async () => {
    mock.in.mockResolvedValueOnce({ data: null, error: null });

    const fetched: FetchedTweet[] = [
      {
        tweetId: "i1",
        text: "Industry one",
        url: "https://x.com/i/1",
        author: "i",
        date: "2024-01-16",
        source: "industry",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.industrySkipped).toBe(0);
    expect(result.industryInserted).toBe(1);
    expect(categorizeTweetBatch).toHaveBeenCalled();
  });

  it("skips industry row when batch result is missing (continue branch)", async () => {
    (categorizeTweetBatch as jest.Mock).mockResolvedValue([
      { category: "other", summary: "First", importance_score: 0.5, topic_title: "First" },
      // second result missing
    ]);

    const fetched: FetchedTweet[] = [
      {
        tweetId: "i1",
        text: "First",
        url: "https://x.com/i/1",
        author: "i",
        date: "2024-01-16",
        source: "industry",
      },
      {
        tweetId: "i2",
        text: "Second",
        url: "https://x.com/i/2",
        author: "i",
        date: "2024-01-16",
        source: "industry",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.industryInserted).toBe(1);
    expect(mock.insert).toHaveBeenCalledTimes(1);
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tweet_id: "i1", url: "https://x.com/i/1" })
    );
  });

  it("inserts industry tweet with topic_title null when AI returns none", async () => {
    (categorizeTweetBatch as jest.Mock).mockResolvedValue([
      { category: "other", summary: "Summary", importance_score: 0.5, topic_title: undefined },
    ]);

    const fetched: FetchedTweet[] = [
      {
        tweetId: "i9",
        text: "Misc",
        url: "https://x.com/i/9",
        author: "i",
        date: "2024-01-16",
        source: "industry",
      },
    ];

    const result = await ingestTweets(fetched);

    expect(result.industryInserted).toBe(1);
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        firm_id: "industry",
        topic_title: null,
        published: false,
      })
    );
  });
});
