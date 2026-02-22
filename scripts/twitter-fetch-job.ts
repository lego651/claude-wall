/**
 * Twitter fetch + ingest script (S8-TW-003 + S8-TW-004)
 *
 * Runs Apify for all monitored firms + industry, dedupes, then batch-AI categorizes
 * and ingests into firm_twitter_tweets and industry_news_items.
 * Persists last run to cron_last_run for admin dashboard.
 *
 * Usage:
 *   npx tsx scripts/twitter-fetch-job.ts
 *
 * Env: APIFY_TOKEN, OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: TWITTER_MAX_ITEMS_*, TWITTER_AI_BATCH_SIZE.
 */

import "dotenv/config";
import { runTwitterFetchJob } from "@/lib/twitter-fetch/fetch-job";
import { ingestTweets } from "@/lib/twitter-ingest/ingest";
import { createServiceClient } from "@/lib/supabase/service";

const CRON_JOB_NAME = "twitter_fetch_ingest";

async function persistCronLastRun(result: {
  firmInserted: number;
  firmSkipped: number;
  industryInserted: number;
  industrySkipped: number;
  durationMs: number;
}) {
  try {
    const supabase = createServiceClient();
    await supabase.from("cron_last_run").upsert(
      {
        job_name: CRON_JOB_NAME,
        last_run_at: new Date().toISOString(),
        result_json: result,
      },
      { onConflict: "job_name" }
    );
  } catch (e) {
    console.error("[Twitter fetch] persistCronLastRun", e);
  }
}

async function main() {
  if (!process.env.APIFY_TOKEN?.trim()) {
    console.error("[Twitter fetch] APIFY_TOKEN is not set. Add it to .env and run again.");
    process.exit(1);
  }

  console.log("[Twitter fetch] Starting fetch job (firms + industry)...");
  const start = Date.now();

  const tweets = await runTwitterFetchJob();

  const firmCount = tweets.filter((t) => t.source === "firm").length;
  const industryCount = tweets.filter((t) => t.source === "industry").length;
  console.log(
    `[Twitter fetch] Done in ${((Date.now() - start) / 1000).toFixed(1)}s. Total: ${tweets.length} (firm: ${firmCount}, industry: ${industryCount})`
  );

  if (tweets.length === 0) {
    await persistCronLastRun({
      firmInserted: 0,
      firmSkipped: 0,
      industryInserted: 0,
      industrySkipped: 0,
      durationMs: Date.now() - start,
    });
    process.exit(0);
  }

  const byFirm = new Map<string, number>();
  for (const t of tweets) {
    if (t.source === "firm" && t.firmId) {
      byFirm.set(t.firmId, (byFirm.get(t.firmId) ?? 0) + 1);
    }
  }
  for (const [firmId, count] of byFirm) {
    console.log(`  ${firmId}: ${count}`);
  }
  if (industryCount > 0) {
    console.log(`  industry: ${industryCount}`);
  }

  console.log("[Twitter ingest] Deduping and batch categorizing...");
  const ingestStart = Date.now();
  const result = await ingestTweets(tweets);
  const durationMs = Date.now() - start;
  console.log(
    `[Twitter ingest] Done in ${((Date.now() - ingestStart) / 1000).toFixed(1)}s. Firm: ${result.firmInserted} inserted, ${result.firmSkipped} skipped. Industry: ${result.industryInserted} inserted, ${result.industrySkipped} skipped.`
  );

  await persistCronLastRun({
    firmInserted: result.firmInserted,
    firmSkipped: result.firmSkipped,
    industryInserted: result.industryInserted,
    industrySkipped: result.industrySkipped,
    durationMs,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error("[Twitter fetch] Error:", err);
  process.exit(1);
});
