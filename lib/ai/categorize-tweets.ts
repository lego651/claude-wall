/**
 * Batch tweet categorization for Twitter pipeline (S8-TW-004)
 *
 * Categorizes tweets in batches of ~20 (like Trustpilot), returns category,
 * summary, importance_score; for industry tweets optionally mentioned_firm_ids.
 */

import { getOpenAIClient } from "./openai-client";

const BATCH_SIZE_DEFAULT = 20;
const BATCH_SIZE_MAX = 25;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

export const TWITTER_AI_BATCH_SIZE =
  Math.min(
    BATCH_SIZE_MAX,
    Math.max(1, parseInt(process.env.TWITTER_AI_BATCH_SIZE || String(BATCH_SIZE_DEFAULT), 10) || BATCH_SIZE_DEFAULT)
  );

export const TWEET_CATEGORIES = [
  "company_news",
  "rule_change",
  "promotion",
  "complaint",
  "off_topic",
  "other",
] as const;

export type TweetCategory = (typeof TWEET_CATEGORIES)[number];

export interface TweetCategorizeInput {
  text: string;
  url?: string;
  author?: string;
}

export interface TweetCategorizeResult {
  category: string;
  summary: string;
  importance_score: number;
  /** Short headline (3–8 words) for grouping; same topic = same phrasing (TG-002) */
  topic_title: string;
  mentioned_firm_ids?: string[];
}

const CATEGORY_INSTRUCTIONS = `Categories (pick ONE per tweet):
- company_news: Firm announcements, new features, partnerships
- rule_change: Trading rules, drawdown, account policy changes
- promotion: Discounts, competitions, offers
- complaint: User complaints, payout issues, support issues
- off_topic: Unrelated to prop trading / the firm
- other: Doesn't fit above

Importance: 0-1 score. How relevant/important is this tweet for the firm's subscribers?
- 0.8-1: Breaking news, rule change, payout issue, major promotion
- 0.3-0.7: Relevant mention, minor update
- 0-0.2: Off-topic, spam, generic praise

If industry tweets: also extract mentioned_firm_ids (array of firm ids: fundingpips, fundednext, ftmo, topstep, etc.)

For every tweet also provide topic_title: a short headline (3-8 words) for the main theme, e.g. "Prop firm payout delays", "FundingPips rule change". Use consistent phrasing for tweets about the same topic so they can be grouped later.`;

function buildBatchPrompt(tweets: TweetCategorizeInput[], isIndustry: boolean): string {
  const parts = tweets.map((t, i) => {
    const text = (t.text || "").slice(0, 500);
    return `--- Tweet ${i + 1} ---\n${text}`;
  });
  return `Analyze each of the following ${tweets.length} tweets about prop trading firms. Return one result per tweet in the same order.

${parts.join("\n\n")}

${CATEGORY_INSTRUCTIONS}

Respond with a JSON object: {"results": [{"category":"...","summary":"1-2 sentence summary","importance_score":0.9,"topic_title":"Short headline 3-8 words"${isIndustry ? ',"mentioned_firm_ids":["fundingpips"]' : ""}}, ...]}
Exactly ${tweets.length} objects in results array. No other text.`;
}

export async function categorizeTweetBatch(
  tweets: TweetCategorizeInput[],
  options: { isIndustry?: boolean } = {}
): Promise<TweetCategorizeResult[]> {
  const { isIndustry = false } = options;
  if (tweets.length === 0) return [];

  const openai = getOpenAIClient();
  const prompt = buildBatchPrompt(tweets, isIndustry);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: Math.min(16384, 400 + tweets.length * 100),
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) throw new Error("Empty OpenAI response");

      const parsed = JSON.parse(raw) as { results?: unknown[] };
      const arr = Array.isArray(parsed?.results) ? parsed.results : null;
      if (!arr || arr.length === 0) throw new Error(`Expected ${tweets.length} results, got 0`);

      const toUse = arr.slice(0, tweets.length);
      const results: TweetCategorizeResult[] = [];

      for (let i = 0; i < toUse.length; i++) {
        const item = toUse[i] as Record<string, unknown>;
        const category = String(item?.category ?? "other");
        const summary = typeof item?.summary === "string" ? item.summary.trim() : "";
        let importance_score = typeof item?.importance_score === "number" ? item.importance_score : 0.5;
        importance_score = Math.max(0, Math.min(1, importance_score));
        let topic_title = typeof item?.topic_title === "string" ? item.topic_title.trim().slice(0, 200) : "";
        if (!topic_title) topic_title = "Other";
        const mentioned_firm_ids = Array.isArray(item?.mentioned_firm_ids)
          ? (item.mentioned_firm_ids as string[]).filter((x) => typeof x === "string")
          : undefined;
        results.push({ category, summary, importance_score, topic_title, mentioned_firm_ids });
      }
      return results;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError ?? new Error("Tweet batch categorization failed");
}
