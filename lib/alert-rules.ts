/** Number of hours after which a scraper job is considered stale */
export const SCRAPER_STALE_HOURS = 25;

/** Number of unclassified reviews that triggers a backlog warning */
export const CLASSIFIER_BACKLOG_THRESHOLD = 500;

/** Number of minutes after which the Gmail ingest job is considered stale */
export const EMAIL_INGEST_STALE_MINUTES = 60;

/** Any pipeline error count above this threshold is CRITICAL (0 = any error) */
export const PIPELINE_ERROR_THRESHOLD = 0;

/** Firms newer than this many days are excluded from zero-payout alerts */
export const PAYOUT_ZERO_FIRM_MIN_AGE_DAYS = 7;
