/**
 * Twitter fetch job script (S8-TW-003)
 *
 * Runs Apify for all monitored firms + industry, dedupes, outputs list.
 * Used by cron (S8-TW-005) or manually. Ingest (S8-TW-004) consumes this output.
 *
 * Usage:
 *   npx tsx scripts/twitter-fetch-job.ts
 *
 * Env: APIFY_TOKEN (from .env). Optional: TWITTER_MAX_ITEMS_PER_FIRM, TWITTER_MAX_ITEMS_INDUSTRY, TWITTER_MAX_ITEMS_PER_TERM.
 */

import "dotenv/config";
import { runTwitterFetchJob } from "@/lib/twitter-fetch/fetch-job";

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
    process.exit(0);
  }

  // Log summary per firm
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

  // Output is in memory; ingest (S8-TW-004) will call runTwitterFetchJob() and process tweets.
  process.exit(0);
}

main().catch((err) => {
  console.error("[Twitter fetch] Error:", err);
  process.exit(1);
});
