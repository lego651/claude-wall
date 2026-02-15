/**
 * Trustpilot Backfill Script
 * TICKET-001: Create Trustpilot Backfill Script
 *
 * Scrapes Trustpilot reviews for all firms with trustpilot_url in DB, stores in Supabase,
 * then runs retention cleanup (delete old reviews, incidents, reports).
 * Called daily by GitHub Actions (step1-sync-trustpilot-reviews-daily.yml).
 *
 * Usage:
 *   npx tsx scripts/backfill-trustpilot.ts
 *
 * Env (from .env at project root; do not export in shell):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY - required for DB
 *   TRUSTPILOT_BACKFILL_PAGES       - max pages per firm (default 3)
 *   TRUSTPILOT_MAX_REVIEWS          - max reviews per firm (default 50)
 *   TRUSTPILOT_REVIEWS_RETENTION_DAYS - keep reviews this many days (default 30)
 */

import 'dotenv/config';
import {
  scrapeAndStoreReviews,
  getFirmsWithTrustpilot,
} from '@/lib/scrapers/trustpilot';
import { createServiceClient } from '@/lib/supabase/service';

const config = {
  maxPages: parseInt(process.env.TRUSTPILOT_BACKFILL_PAGES || '3', 10),
  maxReviews: parseInt(process.env.TRUSTPILOT_MAX_REVIEWS || '50', 10),
  headless: true,
};

const REVIEWS_RETENTION_DAYS = parseInt(
  process.env.TRUSTPILOT_REVIEWS_RETENTION_DAYS || '30',
  10
);
const INCIDENTS_RETENTION_DAYS = 30;
const REPORTS_RETENTION_DAYS = 30;

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

async function runRetentionCleanup() {
  const supabase = createServiceClient();
  console.log('[Trustpilot Backfill] Running retention cleanup');

  const reviewCutoff = daysAgo(REVIEWS_RETENTION_DAYS);
  console.log(
    `[Trustpilot Backfill] trustpilot_reviews: delete where review_date < ${reviewCutoff} (${REVIEWS_RETENTION_DAYS}d)`
  );
  const { data: deletedReviews, error: errReviews } = await supabase
    .from('trustpilot_reviews')
    .delete()
    .lt('review_date', reviewCutoff)
    .select('id');
  if (errReviews) throw new Error(`trustpilot_reviews cleanup: ${errReviews.message}`);
  console.log(`[Trustpilot Backfill] trustpilot_reviews: deleted ${deletedReviews?.length ?? 0} rows`);

  const incidentsCutoff = new Date();
  incidentsCutoff.setUTCDate(incidentsCutoff.getUTCDate() - INCIDENTS_RETENTION_DAYS);
  const { data: deletedIncidents, error: errIncidents } = await supabase
    .from('weekly_incidents')
    .delete()
    .lt('created_at', incidentsCutoff.toISOString())
    .select('id');
  if (errIncidents) throw new Error(`weekly_incidents cleanup: ${errIncidents.message}`);
  console.log(`[Trustpilot Backfill] weekly_incidents: deleted ${deletedIncidents?.length ?? 0} rows`);

  const reportsCutoff = new Date();
  reportsCutoff.setUTCDate(reportsCutoff.getUTCDate() - REPORTS_RETENTION_DAYS);
  const { data: deletedReports, error: errReports } = await supabase
    .from('weekly_reports')
    .delete()
    .lt('generated_at', reportsCutoff.toISOString())
    .select('id');
  if (errReports) throw new Error(`weekly_reports cleanup: ${errReports.message}`);
  console.log(`[Trustpilot Backfill] weekly_reports: deleted ${deletedReports?.length ?? 0} rows`);
}

async function updateFirmScraperStatus(
  firmId: string,
  result: { success: boolean; reviewsScraped: number; reviewsStored?: number; duplicatesSkipped?: number; error?: string }
) {
  const supabase = createServiceClient();
  await supabase
    .from('firms')
    .update({
      last_scraper_run_at: new Date().toISOString(),
      last_scraper_reviews_scraped: result.reviewsScraped,
      last_scraper_reviews_stored: result.reviewsStored ?? 0,
      last_scraper_duplicates_skipped: result.duplicatesSkipped ?? 0,
      last_scraper_error: result.success ? null : (result.error ?? 'Unknown error'),
    })
    .eq('id', firmId);
}

async function main() {
  const firms = await getFirmsWithTrustpilot();
  if (firms.length === 0) {
    console.error('[Trustpilot Backfill] No firms with trustpilot_url in DB. Run migration 18 or set firms.trustpilot_url in Supabase.');
    process.exit(1);
  }

  console.log(
    `[Trustpilot Backfill] Starting scrape for ${firms.length} firms (from Supabase firms.trustpilot_url)`
  );
  console.log(
    `[Trustpilot Backfill] Config: maxPages=${config.maxPages}, maxReviews=${config.maxReviews}`
  );

  for (let i = 0; i < firms.length; i++) {
    const firm = firms[i];
    console.log(
      `[Firm ${i + 1}/${firms.length}] Scraping ${firm.id}...`
    );

    const result = await scrapeAndStoreReviews(firm.id, config, firm.trustpilot_url);

    await updateFirmScraperStatus(firm.id, {
      success: result.success,
      reviewsScraped: result.reviewsScraped,
      reviewsStored: result.reviewsStored,
      duplicatesSkipped: result.duplicatesSkipped,
      error: result.error,
    });

    if (!result.success) {
      console.error(`[${firm.id}] Failed: ${result.error}`);
      process.exit(1);
    }

    console.log(
      `[${firm.id}] Scraped ${result.reviewsScraped}, stored ${result.reviewsStored ?? 0}, skipped ${result.duplicatesSkipped ?? 0} duplicates`
    );
  }

  await runRetentionCleanup();
  console.log('[Trustpilot Backfill] Completed successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
