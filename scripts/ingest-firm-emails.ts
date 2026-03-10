/**
 * Gmail Firm Email Ingest Script
 *
 * Fetches new emails from the monitored Gmail account, categorizes with AI,
 * and writes results to firm_content_items in Supabase.
 * Called every 15 minutes by GitHub Actions (ingest-firm-emails.yml).
 *
 * Usage:
 *   npx tsx scripts/ingest-firm-emails.ts
 *
 * Env (from .env at project root):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import 'dotenv/config';
import { ingestFirmEmails } from '../lib/gmail/ingest';

async function main() {
  console.log('[Script] Starting Gmail firm email ingest...');

  try {
    const result = await ingestFirmEmails();
    console.log('[Script] Ingest complete:', result);

    if (result.errors > 0) {
      console.warn(`[Script] Completed with ${result.errors} error(s)`);
      process.exit(1);
    }
  } catch (err) {
    console.error('[Script] Fatal error:', err);
    process.exit(1);
  }
}

main();
