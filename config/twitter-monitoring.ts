/**
 * Twitter / X monitoring config (S8-TW-001)
 *
 * Single place to define which firms we monitor and which search terms to use.
 * Used by the Twitter fetch job (Apify) and ingest pipeline.
 * Edit here to add firms or change keywords without DB changes.
 */

export interface TwitterMonitoringFirmHandle {
  firmId: string;
  /** Official X/Twitter handle (without @). Used to build combined from: query. */
  handle: string;
}

/** Firm official handles to monitor. Fetched in a single combined from: query (Run 1). */
export const TWITTER_FIRM_HANDLES: TwitterMonitoringFirmHandle[] = [
  { firmId: "fundednext", handle: "FundedNext" },
  { firmId: "fundingpips", handle: "FundingPips" },
  { firmId: "alphacapitalgroup", handle: "AlphaCapitalGroup" },
];

/** Industry-wide search terms (not tied to one firm). Results → industry_news_items. */
export const TWITTER_INDUSTRY_SEARCH_TERMS: string[] = [
  "prop firm",
  "prop firms",
  "prop firm news",
  "prop firms news",
  "Topstep",
  "funded trading",
  "prop trading news",
  "funded account",
  "prop firm regulation",
  "prop firm payout",
];

/** Max items per handle in the combined firm official run (cap cost per firm). Default 50. */
export const TWITTER_MAX_ITEMS_PER_FIRM = 50;

/** Max items for industry run total. */
export const TWITTER_MAX_ITEMS_INDUSTRY = 100;
