/**
 * TEST SCRIPT FOR TRUSTPILOT SCRAPER
 * TICKET-002: Testing
 *
 * Run with: npx tsx scripts/test-trustpilot-scraper.ts
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { scrapeAndStoreReviews } from '../lib/scrapers/trustpilot';

async function main() {
  console.log('='.repeat(80));
  console.log('TRUSTPILOT SCRAPER TEST');
  console.log('='.repeat(80));

  // Use firms that exist in the database (from your screenshot)
  const firms = ['fundednext', 'the5ers', 'fundingpips'];

  for (const firmId of firms) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${firmId.toUpperCase()}`);
    console.log('='.repeat(80));

    try {
      const result = await scrapeAndStoreReviews(firmId, {
        headless: true,
        maxReviews: 10, // Test with fewer reviews
      });

      console.log('\n📊 RESULTS:');
      console.log(`  Success: ${result.success ? '✅' : '❌'}`);
      console.log(`  Reviews scraped: ${result.reviewsScraped}`);
      console.log(`  Reviews stored: ${result.reviewsStored}`);
      console.log(`  Duplicates skipped: ${result.duplicatesSkipped}`);

      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      }

      if (result.reviews.length > 0) {
        console.log(`\n📝 Sample review:`);
        const sample = result.reviews[0];
        console.log(`  Rating: ${sample.rating}/5 ⭐`);
        console.log(`  Title: ${sample.title || '(no title)'}`);
        console.log(`  Date: ${sample.reviewDate.toLocaleDateString()}`);
        console.log(`  Text: ${sample.reviewText.substring(0, 100)}...`);
      }

      // Add delay between firms
      if (firmId !== firms[firms.length - 1]) {
        console.log('\n⏳ Waiting 5 seconds before next firm...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      console.error(`\n❌ Test failed for ${firmId}:`, error);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ TEST COMPLETE');
  console.log('='.repeat(80));
  console.log('\nNext steps:');
  console.log('1. Check Supabase dashboard for stored reviews');
  console.log('2. Run: SELECT COUNT(*) FROM trustpilot_reviews;');
  console.log('3. Verify no duplicates with unique constraint');
}

main().catch(console.error);
