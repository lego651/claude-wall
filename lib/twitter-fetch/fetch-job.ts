/**
 * Twitter fetch job (S8-TW-003)
 *
 * Reads config, runs Apify for each monitored firm and once for industry,
 * merges and dedupes by tweet ID, returns list for ingest.
 */

import { runTwitterSearch, type NormalizedTweet } from "@/lib/apify/twitter-scraper";
import {
  TWITTER_MONITORING_FIRMS,
  TWITTER_INDUSTRY_SEARCH_TERMS,
  TWITTER_MAX_ITEMS_PER_TERM,
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
  source: "firm" | "industry";
}

function fromEnvInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : Math.max(0, n);
}

/**
 * Run Apify for all monitored firms and industry; merge and dedupe by tweet ID.
 * Returns list of tweets with firmId (firm) or source 'industry' for ingest.
 */
export async function runTwitterFetchJob(): Promise<FetchedTweet[]> {
  const maxPerFirm = fromEnvInt("TWITTER_MAX_ITEMS_PER_FIRM", TWITTER_MAX_ITEMS_PER_FIRM);
  const maxIndustry = fromEnvInt("TWITTER_MAX_ITEMS_INDUSTRY", TWITTER_MAX_ITEMS_INDUSTRY);
  const maxPerTerm = fromEnvInt("TWITTER_MAX_ITEMS_PER_TERM", TWITTER_MAX_ITEMS_PER_TERM);

  const all: FetchedTweet[] = [];
  const seenIds = new Set<string>();

  function add(norm: NormalizedTweet, firmId?: string, source: "firm" | "industry" = "firm") {
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

  // Per-firm runs
  for (const firm of TWITTER_MONITORING_FIRMS) {
    const tweets = await runTwitterSearch({
      searchTerms: firm.searchTerms,
      maxItemsPerTerm: maxPerTerm,
      maxItemsTotal: maxPerFirm,
    });
    for (const t of tweets) add(t, firm.firmId, "firm");
  }

  // Industry run
  const industryTweets = await runTwitterSearch({
    searchTerms: TWITTER_INDUSTRY_SEARCH_TERMS,
    maxItemsPerTerm: maxPerTerm,
    maxItemsTotal: maxIndustry,
  });
  for (const t of industryTweets) add(t, undefined, "industry");

  return all;
}
