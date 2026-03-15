import { summarizeVideo, summarizeVideos } from "./summarize-video";

jest.mock("@/lib/ai/openai-client", () => ({
  getOpenAIClient: jest.fn(),
}));

import { getOpenAIClient } from "@/lib/ai/openai-client";

const mockCreate = jest.fn();
const mockOpenAI = { chat: { completions: { create: mockCreate } } };

beforeEach(() => {
  jest.clearAllMocks();
  (getOpenAIClient as jest.Mock).mockReturnValue(mockOpenAI);
});

describe("summarizeVideo", () => {
  const input = { title: "How to Pass FTMO Challenge", channelName: "TraderNick", views: 5000 };

  it("returns summary text on success", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "A great summary." } }],
    });
    const result = await summarizeVideo(input);
    expect(result).toBe("A great summary.");
  });

  it("trims whitespace from response", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "  Trimmed.  " } }],
    });
    const result = await summarizeVideo(input);
    expect(result).toBe("Trimmed.");
  });

  it("returns null after all retries fail", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));
    const result = await summarizeVideo(input);
    expect(result).toBeNull();
  });

  it("returns null if response content is empty", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });
    const result = await summarizeVideo(input);
    expect(result).toBeNull();
  });

  it("retries on transient failure then succeeds", async () => {
    mockCreate
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue({
        choices: [{ message: { content: "Success on retry." } }],
      });
    const result = await summarizeVideo(input);
    expect(result).toBe("Success on retry.");
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

describe("summarizeVideos", () => {
  it("returns array of summaries in order", async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: "Summary 1." } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: "Summary 2." } }] });

    const results = await summarizeVideos([
      { title: "Video A", channelName: "Ch A", views: 1000 },
      { title: "Video B", channelName: "Ch B", views: 2000 },
    ]);
    expect(results).toEqual(["Summary 1.", "Summary 2."]);
  });

  it("returns null entries for failed summaries", async () => {
    mockCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: "OK" } }] })
      .mockRejectedValue(new Error("fail"));

    const results = await summarizeVideos([
      { title: "Video A", channelName: "Ch A", views: 1000 },
      { title: "Video B", channelName: "Ch B", views: 2000 },
    ]);
    expect(results[0]).toBe("OK");
    expect(results[1]).toBeNull();
  });

  it("returns empty array for empty input", async () => {
    const results = await summarizeVideos([]);
    expect(results).toEqual([]);
  });
});
