import { postTweet } from "./client";
import { TwitterApi } from "twitter-api-v2";

jest.mock("twitter-api-v2");

const MockedTwitterApi = TwitterApi as jest.MockedClass<typeof TwitterApi>;

const VALID_ENV = {
  TWITTER_API_KEY: "test-key",
  TWITTER_API_SECRET: "test-secret",
  TWITTER_ACCESS_TOKEN: "test-token",
  TWITTER_ACCESS_TOKEN_SECRET: "test-token-secret",
};

function setEnv(vars: Record<string, string | undefined>) {
  Object.entries(vars).forEach(([k, v]) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  });
}

function mockApiWithTweet(impl: () => Promise<unknown>) {
  MockedTwitterApi.mockImplementation(
    () => ({ v2: { tweet: jest.fn().mockImplementation(impl) } } as unknown as TwitterApi)
  );
}

beforeEach(() => {
  MockedTwitterApi.mockReset();
  setEnv(VALID_ENV);
});

afterEach(() => {
  setEnv({
    TWITTER_API_KEY: undefined,
    TWITTER_API_SECRET: undefined,
    TWITTER_ACCESS_TOKEN: undefined,
    TWITTER_ACCESS_TOKEN_SECRET: undefined,
  });
});

describe("postTweet", () => {
  it("posts a tweet and returns the tweet ID", async () => {
    mockApiWithTweet(async () => ({ data: { id: "123456789" } }));

    const result = await postTweet("Hello prop traders!");
    expect(result).toEqual({ tweetId: "123456789" });
  });

  it("throws if tweet text is empty", async () => {
    await expect(postTweet("")).rejects.toThrow("Tweet text cannot be empty");
    expect(MockedTwitterApi).not.toHaveBeenCalled();
  });

  it("throws if tweet text is whitespace only", async () => {
    await expect(postTweet("   ")).rejects.toThrow("Tweet text cannot be empty");
    expect(MockedTwitterApi).not.toHaveBeenCalled();
  });

  it("throws if tweet text exceeds 280 chars", async () => {
    await expect(postTweet("a".repeat(281))).rejects.toThrow("too long");
    expect(MockedTwitterApi).not.toHaveBeenCalled();
  });

  it("accepts tweet text of exactly 280 chars", async () => {
    mockApiWithTweet(async () => ({ data: { id: "999" } }));
    const result = await postTweet("a".repeat(280));
    expect(result).toEqual({ tweetId: "999" });
  });

  it("throws with clear message when one credential is missing", async () => {
    setEnv({ TWITTER_API_KEY: undefined });
    await expect(postTweet("Hello")).rejects.toThrow("TWITTER_API_KEY");
  });

  it("throws listing all missing credentials", async () => {
    setEnv({
      TWITTER_API_KEY: undefined,
      TWITTER_API_SECRET: undefined,
      TWITTER_ACCESS_TOKEN: undefined,
      TWITTER_ACCESS_TOKEN_SECRET: undefined,
    });
    await expect(postTweet("Hello")).rejects.toThrow("Missing Twitter API credentials");
  });

  it("throws if Twitter API returns no tweet ID", async () => {
    mockApiWithTweet(async () => ({ data: {} }));
    await expect(postTweet("Hello")).rejects.toThrow("no tweet ID");
  });

  it("propagates Twitter API errors", async () => {
    mockApiWithTweet(async () => { throw new Error("Rate limit exceeded"); });
    await expect(postTweet("Hello")).rejects.toThrow("Rate limit exceeded");
  });
});
