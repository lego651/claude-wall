/**
 * TICKET-008: Batch Classification Cron
 * Fetches unclassified reviews from Supabase, classifies each with OpenAI, updates DB.
 * Run: npx tsx scripts/classify-unclassified-reviews.ts
 *
 * Requires: .env with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { runBatchClassification } from '../lib/ai/batch-classify';

async function main() {
  console.log('='.repeat(60));
  console.log('TICKET-008: Batch Classify Unclassified Reviews');
  console.log('='.repeat(60));

  const result = await runBatchClassification();

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Classified: ${result.classified}`);
  console.log(`  Failed:     ${result.failed}`);
  if (result.errors.length > 0) {
    console.log('  Errors:');
    result.errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
    if (result.errors.length > 10) {
      console.log(`    ... and ${result.errors.length - 10} more`);
    }
  }
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
