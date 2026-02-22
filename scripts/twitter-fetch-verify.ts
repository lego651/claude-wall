/**
 * Verify Apify Twitter integration (S8) – run once after adding APIFY_TOKEN.
 *
 * Calls Apify with one search term and a small max (5 tweets) to confirm
 * token, Actor run, and normalized output. No DB writes.
 *
 * Usage:
 *   npx tsx scripts/twitter-fetch-verify.ts
 *
 * Env: APIFY_TOKEN (from .env at project root).
 */

import "dotenv/config";
import { runTwitterSearch } from "@/lib/apify/twitter-scraper";
import { TWITTER_MONITORING_FIRMS } from "@/config/twitter-monitoring";

async function main() {
  if (!process.env.APIFY_TOKEN?.trim()) {
    console.error("APIFY_TOKEN is not set. Add it to .env and run again.");
    process.exit(1);
  }

  // Use first firm's first search term, cap at 5 tweets (min cost)
  const firm = TWITTER_MONITORING_FIRMS[0];
  const term = firm?.searchTerms[0] ?? "FundingPips";
  const label = firm ? `${firm.firmId}: ${term}` : term;

  console.log("[Twitter verify] Running Apify with one term (max 5 tweets)...");
  console.log("[Twitter verify] Search:", label);

  const tweets = await runTwitterSearch({
    searchTerms: [term],
    maxItemsPerTerm: 5,
  });

  console.log("[Twitter verify] Got", tweets.length, "tweets\n");
  if (tweets.length === 0) {
    console.log("No tweets returned. Check Apify run in console.apify.com or try another term.");
    process.exit(0);
  }

  for (let i = 0; i < tweets.length; i++) {
    const t = tweets[i];
    console.log(`--- ${i + 1}. @${t.authorUsername} (${t.createdAt.slice(0, 10)}) ---`);
    console.log(t.text.slice(0, 200) + (t.text.length > 200 ? "…" : ""));
    console.log(t.url);
    console.log("");
  }

  console.log("[Twitter verify] Done. Apify token and Actor are working.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Twitter verify] Error:", err);
  process.exit(1);
});
