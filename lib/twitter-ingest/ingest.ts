/**
 * Twitter ingest (S8-TW-004)
 *
 * Dedupes fetched tweets against DB, batch-categorizes with AI, inserts
 * firm tweets into firm_twitter_tweets and industry tweets into industry_news_items.
 */

import { createServiceClient } from "@/lib/supabase/service";
import {
  categorizeTweetBatch,
  TWITTER_AI_BATCH_SIZE,
  type TweetCategorizeInput,
  type TweetCategorizeResult,
} from "@/lib/ai/categorize-tweets";
import type { FetchedTweet } from "@/lib/twitter-fetch/fetch-job";

export interface IngestResult {
  firmInserted: number;
  industryInserted: number;
  firmSkipped: number;
  industrySkipped: number;
}

/**
 * Parse ISO or date-only string to YYYY-MM-DD for DB.
 */
function toDateOnly(dateStr: string): string {
  const d = dateStr.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date(dateStr).toISOString().slice(0, 10);
}

/**
 * Dedupe: return tweets that are not already in DB.
 * Firm: (firm_id, url) in firm_twitter_tweets.
 * Industry: source_url in industry_news_items.
 */
async function filterNewTweets(
  tweets: FetchedTweet[],
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ firm: FetchedTweet[]; industry: FetchedTweet[]; firmSkipped: number; industrySkipped: number }> {
  const firm = tweets.filter((t) => t.source === "firm" && t.firmId);
  const industry = tweets.filter((t) => t.source === "industry");

  const firmUrls = [...new Set(firm.map((t) => t.url))];
  const industryUrls = [...new Set(industry.map((t) => t.url))];

  const existingFirm = new Set<string>();
  const existingIndustry = new Set<string>();

  if (firm.length > 0 && firmUrls.length > 0) {
    const { data } = await supabase
      .from("firm_twitter_tweets")
      .select("firm_id, url")
      .in("url", firmUrls);
    if (data) {
      for (const r of data as { firm_id: string; url: string }[]) {
        existingFirm.add(`${r.firm_id}:${r.url}`);
      }
    }
  }

  if (industryUrls.length > 0) {
    const { data } = await supabase
      .from("industry_news_items")
      .select("source_url")
      .in("source_url", industryUrls);
    if (data) {
      for (const r of data as { source_url: string | null }[]) {
        if (r.source_url) existingIndustry.add(r.source_url);
      }
    }
  }

  const firmNew = firm.filter((t) => !existingFirm.has(`${t.firmId!}:${t.url}`));
  const industryNew = industry.filter((t) => !existingIndustry.has(t.url));

  return {
    firm: firmNew,
    industry: industryNew,
    firmSkipped: firm.length - firmNew.length,
    industrySkipped: industry.length - industryNew.length,
  };
}

/**
 * Chunk array into batches of size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Ingest fetched tweets: dedupe, batch AI, insert firm + industry.
 */
export async function ingestTweets(fetched: FetchedTweet[]): Promise<IngestResult> {
  if (fetched.length === 0) {
    return { firmInserted: 0, industryInserted: 0, firmSkipped: 0, industrySkipped: 0 };
  }

  const supabase = createServiceClient();
  const { firm, industry, firmSkipped, industrySkipped } = await filterNewTweets(fetched, supabase);

  const batchSize = TWITTER_AI_BATCH_SIZE;
  let firmInserted = 0;
  let industryInserted = 0;

  // Process firm tweets in batches
  const firmChunks = chunk(firm, batchSize);
  for (const batch of firmChunks) {
    const inputs: TweetCategorizeInput[] = batch.map((t) => ({
      text: t.text,
      url: t.url,
      author: t.author,
    }));
    const results = await categorizeTweetBatch(inputs, { isIndustry: false });
    for (let i = 0; i < batch.length; i++) {
      const t = batch[i];
      const r = results[i] as TweetCategorizeResult | undefined;
      if (!t.firmId || !r) continue;
      const { error } = await supabase.from("firm_twitter_tweets").insert({
        firm_id: t.firmId,
        tweet_id: t.tweetId,
        url: t.url,
        text: t.text,
        author_username: t.author || null,
        tweeted_at: toDateOnly(t.date),
        category: r.category || "other",
        ai_summary: r.summary || null,
        importance_score: r.importance_score ?? 0.5,
      });
      if (!error) firmInserted++;
    }
  }

  // Process industry tweets in batches
  const industryChunks = chunk(industry, batchSize);
  for (const batch of industryChunks) {
    const inputs: TweetCategorizeInput[] = batch.map((t) => ({
      text: t.text,
      url: t.url,
      author: t.author,
    }));
    const results = await categorizeTweetBatch(inputs, { isIndustry: true });
    for (let i = 0; i < batch.length; i++) {
      const t = batch[i];
      const r = results[i] as TweetCategorizeResult | undefined;
      if (!r) continue;
      const title = (t.text || "").slice(0, 200).trim() || "Twitter post";
      const contentDate = toDateOnly(t.date);
      const { error } = await supabase.from("industry_news_items").insert({
        title,
        raw_content: t.text,
        source_url: t.url,
        source_type: "twitter",
        ai_summary: r.summary || null,
        ai_category: r.category || "other",
        ai_confidence: 0.8,
        ai_tags: [],
        mentioned_firm_ids: r.mentioned_firm_ids ?? [],
        topic_title: r.topic_title?.trim()?.slice(0, 200) || null,
        published: false,
        content_date: contentDate,
      });
      if (!error) industryInserted++;
    }
  }

  return {
    firmInserted,
    industryInserted,
    firmSkipped,
    industrySkipped,
  };
}
