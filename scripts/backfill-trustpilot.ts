/**
 * TICKET-003: Historical Data Backfill
 *
 * Run scraper for all supported firms (8 firms; FTMO and TopStep not supported yet).
 * Default 6 pages per firm (~40–120 reviews each); daily cron uses 3 pages (TRUSTPILOT_BACKFILL_PAGES=3).
 *
 * Run with: npx tsx scripts/backfill-trustpilot.ts
 *
 * Requires: .env with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { scrapeAndStoreReviews, TRUSTPILOT_FIRM_IDS } from '../lib/scrapers/trustpilot';

const DELAY_BETWEEN_FIRMS_MS = 5000;
const DEFAULT_PAGES = 6;
const MAX_PAGES = parseInt(process.env.TRUSTPILOT_BACKFILL_PAGES || '', 10) || DEFAULT_PAGES;
const MAX_REVIEWS_ENV = process.env.TRUSTPILOT_MAX_REVIEWS
  ? parseInt(process.env.TRUSTPILOT_MAX_REVIEWS, 10)
  : null;
const MAX_REVIEWS = MAX_REVIEWS_ENV != null && MAX_REVIEWS_ENV > 0
  ? Math.min(MAX_REVIEWS_ENV, 400)
  : Math.min(MAX_PAGES * 55, 400);

async function main() {
  const firms = TRUSTPILOT_FIRM_IDS;
  console.log('='.repeat(80));
  console.log('TICKET-003: TRUSTPILOT HISTORICAL BACKFILL');
  console.log('='.repeat(80));
  console.log(`Firms: ${firms.join(', ')} (${firms.length} total)`);
  console.log(`Target: ${MAX_PAGES} pages per firm, max ${MAX_REVIEWS} reviews (daily: 3 pages, 50 reviews)\n`);

  const results: Array<{
    firmId: string;
    success: boolean;
    reviewsScraped: number;
    reviewsStored: number;
    duplicatesSkipped: number;
    error?: string;
  }> = [];

  for (const firmId of firms) {
    console.log('\n' + '-'.repeat(80));
    console.log(`Backfilling: ${firmId}`);
    console.log('-'.repeat(80));

    try {
      const result = await scrapeAndStoreReviews(firmId, {
        headless: true,
        maxPages: MAX_PAGES,
        maxReviews: MAX_REVIEWS,
        delayMs: 3000,
        timeout: 30000,
      });

      results.push({
        firmId,
        success: result.success,
        reviewsScraped: result.reviewsScraped,
        reviewsStored: result.reviewsStored,
        duplicatesSkipped: result.duplicatesSkipped,
        error: result.error,
      });

      console.log(
        `  Scraped: ${result.reviewsScraped} | Stored: ${result.reviewsStored} | Duplicates skipped: ${result.duplicatesSkipped}`
      );
      if (result.error) console.log(`  ⚠ ${result.error}`);

      if (firmId !== firms[firms.length - 1]) {
        console.log(`\n  ⏳ Waiting ${DELAY_BETWEEN_FIRMS_MS / 1000}s before next firm...`);
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_FIRMS_MS));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed: ${message}`);
      results.push({
        firmId,
        success: false,
        reviewsScraped: 0,
        reviewsStored: 0,
        duplicatesSkipped: 0,
        error: message,
      });
    }
  }

  // Summary
  const totalScraped = results.reduce((s, r) => s + r.reviewsScraped, 0);
  const totalStored = results.reduce((s, r) => s + r.reviewsStored, 0);
  const totalDuplicates = results.reduce((s, r) => s + r.duplicatesSkipped, 0);
  const allOk = results.every((r) => r.success);

  console.log('\n' + '='.repeat(80));
  console.log('BACKFILL SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total scraped: ${totalScraped}`);
  console.log(`  Total stored:  ${totalStored}`);
  console.log(`  Duplicates skipped: ${totalDuplicates}`);
  console.log(`  Status: ${allOk ? '✅ All firms completed' : '⚠ Some firms had errors'}`);
  console.log('='.repeat(80));

  console.log('\nVerification (run in Supabase SQL editor):');
  console.log('  -- No duplicates:');
  console.log('  SELECT trustpilot_url, COUNT(*) FROM trustpilot_reviews GROUP BY trustpilot_url HAVING COUNT(*) > 1;');
  console.log('  -- Count by firm:');
  console.log('  SELECT firm_id, COUNT(*) FROM trustpilot_reviews GROUP BY firm_id;');
  console.log('  -- Dates and fields:');
  console.log('  SELECT firm_id, review_date, rating, title, LENGTH(review_text) FROM trustpilot_reviews ORDER BY review_date DESC LIMIT 10;');
  console.log('\nDocument any scraping issues (blocked URLs, missing data) in docs/TICKET-003-BACKFILL.md');
}

main().catch(console.error);
