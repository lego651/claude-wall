/**
 * TICKET-003: Historical Data Backfill
 *
 * Run scraper for the5ers, fundingpips, fundednext (3 pages per firm, ~20–60 reviews each).
 * Use for initial data load before daily cron.
 *
 * Run with: npx tsx scripts/backfill-trustpilot.ts
 *
 * Requires: .env with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { scrapeAndStoreReviews } from '../lib/scrapers/trustpilot';

const BACKFILL_FIRMS = ['the5ers', 'fundingpips', 'fundednext'] as const;
const DELAY_BETWEEN_FIRMS_MS = 5000;

async function main() {
  console.log('='.repeat(80));
  console.log('TICKET-003: TRUSTPILOT HISTORICAL BACKFILL');
  console.log('='.repeat(80));
  console.log(`Firms: ${BACKFILL_FIRMS.join(', ')}`);
  console.log(`Target: 3 pages per firm (~20–60 reviews each, ~60–180 total)\n`);

  const results: Array<{
    firmId: string;
    success: boolean;
    reviewsScraped: number;
    reviewsStored: number;
    duplicatesSkipped: number;
    error?: string;
  }> = [];

  for (const firmId of BACKFILL_FIRMS) {
    console.log('\n' + '-'.repeat(80));
    console.log(`Backfilling: ${firmId.toUpperCase()}`);
    console.log('-'.repeat(80));

    try {
      const result = await scrapeAndStoreReviews(firmId, {
        headless: true,
        maxPages: 3,
        maxReviews: 150,
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

      if (firmId !== BACKFILL_FIRMS[BACKFILL_FIRMS.length - 1]) {
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
