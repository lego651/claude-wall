/**
 * Twitter / X monitoring config (S8-TW-001)
 *
 * Single place to define which firms we monitor and which search terms to use.
 * Used by the Twitter fetch job (Apify) and ingest pipeline.
 * Edit here to add firms or change keywords without DB changes.
 */

export interface TwitterMonitoringFirm {
  firmId: string;
  searchTerms: string[];
}

/** Firms to monitor for Twitter (test: 3 only). Each has multiple search terms. */
export const TWITTER_MONITORING_FIRMS: TwitterMonitoringFirm[] = [
  {
    firmId: "fundednext",
    searchTerms: [
      "Funded Next",
      "FundedNext",
      "from:FundedNext",
      "Funded Next prop firm",
      "Funded Next payout",
    ],
  },
  {
    firmId: "fundingpips",
    searchTerms: [
      "FundingPips",
      "Funding Pips",
      "from:FundingPips",
      "FundingPips prop firm",
      "FundingPips payout",
    ],
  },
  {
    firmId: "alphacapitalgroup",
    searchTerms: [
      "Alpha Capital Group",
      "Alpha Capital",
      "ACG prop",
      "from:AlphaCapitalGroup",
      "Alpha Capital Group prop firm",
    ],
  },
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

/** Max items to fetch per search term (cap cost and volume). Default 50. */
export const TWITTER_MAX_ITEMS_PER_TERM = 50;

/** Max items total per firm across all its terms (optional safety cap). */
export const TWITTER_MAX_ITEMS_PER_FIRM = 150;

/** Max items for industry run total. */
export const TWITTER_MAX_ITEMS_INDUSTRY = 100;
