/**
 * Test OpenAI API connection and classifier (TICKET-005 / TICKET-006).
 * Run: npx tsx scripts/test-openai.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('Checking OPENAI_API_KEY...');
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('❌ OPENAI_API_KEY is not set in .env');
    process.exit(1);
  }
  console.log(`✅ OPENAI_API_KEY is set (${key.slice(0, 7)}...${key.slice(-4)})\n`);

  console.log('Testing API connection (gpt-4o-mini)...');
  const { testOpenAIConnection } = await import('../lib/ai/openai-client');
  const ok = await testOpenAIConnection();
  if (!ok) {
    console.error('❌ API connection test failed');
    process.exit(1);
  }
  console.log('✅ API connection OK\n');

  console.log('Testing classifier (one review)...');
  const { classifyReview } = await import('../lib/ai/classifier');
  const result = await classifyReview({
    rating: 2,
    title: 'Payout delayed',
    text: 'I have been waiting 2 weeks for my withdrawal. Support says it is processing but no update.',
  });
  console.log('✅ Classifier OK');
  console.log('   Result:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
