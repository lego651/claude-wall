import { generateTweetDraft, type YouTubePickInput } from "./generate-tweet";

// Mock OpenAI client
const mockCreate = jest.fn();
jest.mock("@/lib/ai/openai-client", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create: mockCreate } },
  }),
}));

const BASE_PICK: YouTubePickInput = {
  videoId: "abc123",
  title: "How I Passed My FTMO Challenge in 7 Days",
  channelName: "TraderNick",
  channelId: "UCtest",
  videoUrl: "https://www.youtube.com/watch?v=abc123",
  aiSummary: "A trader shares the exact strategy used to pass a €100k FTMO challenge in under two weeks.",
  twitterHandle: "tradernick",
};

beforeEach(() => {
  mockCreate.mockReset();
  process.env.NEXT_PUBLIC_APP_URL = "https://propfirmhub.com";
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("generateTweetDraft", () => {
  describe("Template A (with creator handle)", () => {
    it("uses Template A when twitter handle is present", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Pass your FTMO challenge faster with this exact strategy." } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);

      expect(draft.template).toBe("A");
      expect(draft.creatorHandle).toBe("tradernick");
      expect(draft.tweetText).toContain("@tradernick");
    });

    it("includes the YouTube URL in the tweet", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "A solid breakdown of the FTMO challenge process." } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);
      expect(draft.tweetText).toContain("youtube.com");
    });

    it("includes the UTM-tagged news URL", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Solid FTMO challenge breakdown." } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);
      expect(draft.newsUrl).toContain("utm_source=twitter");
      expect(draft.newsUrl).toContain("utm_medium=bot");
      expect(draft.newsUrl).toContain("utm_campaign=daily-picks");
      expect(draft.tweetText).toContain("utm_source=twitter");
    });

    it("includes #PropTrading hashtag", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Sharp FTMO breakdown." } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);
      expect(draft.tweetText).toContain("#PropTrading");
    });
  });

  describe("Template B (no creator handle)", () => {
    it("uses Template B when twitter handle is null", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Sharp breakdown of the FTMO challenge process." } }],
      });

      const pickNoHandle: YouTubePickInput = { ...BASE_PICK, twitterHandle: null };
      const draft = await generateTweetDraft(pickNoHandle);

      expect(draft.template).toBe("B");
      expect(draft.creatorHandle).toBeNull();
      expect(draft.tweetText).not.toContain("@");
    });

    it("still includes YouTube URL and news URL in Template B", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "A great FTMO breakdown." } }],
      });

      const pickNoHandle: YouTubePickInput = { ...BASE_PICK, twitterHandle: null };
      const draft = await generateTweetDraft(pickNoHandle);

      expect(draft.tweetText).toContain("youtube.com");
      expect(draft.tweetText).toContain("utm_source=twitter");
    });
  });

  describe("character limit", () => {
    it("produces a tweet within 280 chars", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "A concise hook." } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);
      expect(draft.charCount).toBeLessThanOrEqual(280);
      expect(draft.tweetText.length).toBeLessThanOrEqual(280);
    });

    it("stays within 280 Twitter-counted chars even with a long title as fallback", async () => {
      // OpenAI fails → falls back to title-based hook
      mockCreate.mockRejectedValueOnce(new Error("OpenAI down"));

      const longTitlePick: YouTubePickInput = {
        ...BASE_PICK,
        title: "A".repeat(100),
        aiSummary: "B".repeat(150),
      };

      const draft = await generateTweetDraft(longTitlePick);
      // charCount uses Twitter's URL-length rules (each URL = 23 chars)
      expect(draft.charCount).toBeLessThanOrEqual(280);
    });
  });

  describe("OpenAI fallback", () => {
    it("uses title as fallback hook when OpenAI fails", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Network error"));

      const draft = await generateTweetDraft(BASE_PICK);
      // Should still produce a valid draft
      expect(draft.tweetText).toBeTruthy();
      expect(draft.charCount).toBeLessThanOrEqual(280);
    });

    it("uses title as fallback when OpenAI returns empty content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "" } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);
      expect(draft.tweetText).toBeTruthy();
    });
  });

  describe("metadata", () => {
    it("returns the correct video title and URL", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Great FTMO breakdown." } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);
      expect(draft.videoTitle).toBe(BASE_PICK.title);
      expect(draft.videoUrl).toBe(BASE_PICK.videoUrl);
    });

    it("uses NEXT_PUBLIC_APP_URL for news URL base", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "A hook." } }],
      });

      const draft = await generateTweetDraft(BASE_PICK);
      expect(draft.newsUrl).toContain("https://example.com/news");
    });
  });
});
