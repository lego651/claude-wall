/**
 * Daily incident detection for all supported firms (current week).
 * Writes to weekly_incidents. Run via cron (e.g. after classifier).
 *
 * Run: npx tsx scripts/run-daily-incidents.ts
 *
 * Requires: .env with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { detectIncidents } from '../lib/digest/incident-aggregator';
import { getWeekBounds } from '../lib/digest/week-utils';
import { TRUSTPILOT_FIRM_IDS } from '../lib/scrapers/trustpilot';

const DELAY_BETWEEN_FIRMS_MS = 2000;

async function main() {
  const now = new Date();
  const { weekStart, weekEnd } = getWeekBounds(now);

  console.log('Daily incident detection (current week)');
  console.log('Week:', weekStart.toISOString().slice(0, 10), '–', weekEnd.toISOString().slice(0, 10));
  console.log('Firms:', TRUSTPILOT_FIRM_IDS.join(', '));
  console.log('');

  for (const firmId of TRUSTPILOT_FIRM_IDS) {
    try {
      const incidents = await detectIncidents(firmId, weekStart, weekEnd);
      console.log(`  ${firmId}: ${incidents.length} incident(s)`);
      if (firmId !== TRUSTPILOT_FIRM_IDS[TRUSTPILOT_FIRM_IDS.length - 1]) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_FIRMS_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ${firmId}: ERROR – ${msg}`);
    }
  }

  console.log('');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
