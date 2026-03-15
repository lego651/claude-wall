/**
 * GPT-4o-mini summarizer for the top-3 YouTube picks.
 * Called only 3 times/day — cost ~$0.001/day.
 */

import { getOpenAIClient } from "@/lib/ai/openai-client";

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

export interface VideoSummaryInput {
  title: string;
  channelName: string;
  views: number;
}

/**
 * Generate a 1–2 sentence AI summary for a video based on its title and metadata.
 * Returns null on failure so the caller can proceed without a summary.
 */
export async function summarizeVideo(
  video: VideoSummaryInput
): Promise<string | null> {
  const prompt = `You are writing a 1-2 sentence summary for a prop trading industry news feed.

Video title: "${video.title}"
Channel: ${video.channelName}
Views: ${video.views.toLocaleString()}

Write a concise, informative 1-2 sentence summary of what this video likely covers, based on the title. Be factual and professional. Do not make up specific claims beyond what the title implies. Output only the summary text, no quotes or labels.`;

  const openai = getOpenAIClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 120,
      });

      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty OpenAI response");
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) =>
          setTimeout(r, RETRY_BACKOFF_MS * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  console.error("[summarize-video] Failed after retries:", lastError?.message);
  return null;
}

/**
 * Summarize a list of videos in sequence. Returns an array of summaries
 * aligned with the input array (null if a summary failed).
 */
export async function summarizeVideos(
  videos: VideoSummaryInput[]
): Promise<(string | null)[]> {
  const results: (string | null)[] = [];
  for (const video of videos) {
    results.push(await summarizeVideo(video));
  }
  return results;
}
