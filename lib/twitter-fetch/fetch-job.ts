/**
 * Twitter fetch job (S8-TW-003, refactored S10-011)
 *
 * Hybrid 2-run model:
 *   Run 1: single Apify call with combined from: query for all firm official handles
 *   Run 2: single Apify call for industry keywords
 *
 * This replaces the old N+1 per-firm model and always uses exactly 2 Apify runs.
 */

import { runTwitterSearch, type NormalizedTweet } from "@/lib/apify/twitter-scraper";
import {
  TWITTER_FIRM_HANDLES,
  TWITTER_INDUSTRY_SEARCH_TERMS,
  TWITTER_MAX_ITEMS_PER_FIRM,
  TWITTER_MAX_ITEMS_INDUSTRY,
} from "@/config/twitter-monitoring";

export interface FetchedTweet {
  tweetId: string;
  text: string;
  url: string;
  author: string;
  date: string; // ISO date or date part
  firmId?: string;
  source: "firm_official" | "industry";
}

function fromEnvInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : Math.max(0, n);
}

/**
 * Run Apify with hybrid 2-run model:
 *   Run 1: combined from: query across all firm handles → attribute by authorUsername
 *   Run 2: industry keywords (unchanged)
 * Returns list of tweets with firmId (firm_official) or source 'industry' for ingest.
 */
export async function runTwitterFetchJob(): Promise<FetchedTweet[]> {
  const maxPerFirm = fromEnvInt("TWITTER_MAX_ITEMS_PER_FIRM", TWITTER_MAX_ITEMS_PER_FIRM);
  const maxIndustry = fromEnvInt("TWITTER_MAX_ITEMS_INDUSTRY", TWITTER_MAX_ITEMS_INDUSTRY);

  const all: FetchedTweet[] = [];
  const seenIds = new Set<string>();

  function add(norm: NormalizedTweet, firmId?: string, source: FetchedTweet["source"] = "firm_official") {
    if (seenIds.has(norm.id)) return;
    seenIds.add(norm.id);
    const date = norm.createdAt.slice(0, 10); // YYYY-MM-DD
    all.push({
      tweetId: norm.id,
      text: norm.text,
      url: norm.url,
      author: norm.authorUsername,
      date,
      firmId,
      source,
    });
  }

  // Run 1: combined from: query for all firm official handles
  if (TWITTER_FIRM_HANDLES.length > 0) {
    const combinedQuery = TWITTER_FIRM_HANDLES.map((f) => `from:${f.handle}`).join(" OR ");
    const firmRunTotal = maxPerFirm * TWITTER_FIRM_HANDLES.length;

    const firmOfficialTweets = await runTwitterSearch({
      searchTerms: [combinedQuery],
      maxItemsPerTerm: firmRunTotal,
      maxItemsTotal: firmRunTotal,
    });

    // Build case-insensitive handle → firmId map for attribution
    const handleToFirmId = new Map(
      TWITTER_FIRM_HANDLES.map((f) => [f.handle.toLowerCase(), f.firmId])
    );

    for (const t of firmOfficialTweets) {
      const firmId = handleToFirmId.get(t.authorUsername.toLowerCase());
      add(t, firmId, "firm_official");
    }
  }

  // Run 2: industry run (unchanged)
  const industryTweets = await runTwitterSearch({
    searchTerms: TWITTER_INDUSTRY_SEARCH_TERMS,
    maxItemsPerTerm: maxIndustry,
    maxItemsTotal: maxIndustry,
  });
  for (const t of industryTweets) add(t, undefined, "industry");

  return all;
}
