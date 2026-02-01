/**
 * Backfill weekly_incidents from classified trustpilot_reviews.
 * Runs incident detection for each supported firm and each past week in range.
 *
 * Run: npx tsx scripts/backfill-weekly-incidents.ts [weeksBack]
 * Example: npx tsx scripts/backfill-weekly-incidents.ts 12
 *   (backfills last 12 weeks for all firms)
 *
 * Default: 12 weeks. Uses existing detectIncidents() which deletes that firm+week
 * and inserts new rows, so re-running is idempotent.
 *
 * Requires: .env with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { detectIncidents } from '../lib/digest/incident-aggregator';
import { getWeekBounds } from '../lib/digest/week-utils';
import { TRUSTPILOT_FIRM_IDS } from '../lib/scrapers/trustpilot';

const DEFAULT_WEEKS_BACK = 12;
const DELAY_BETWEEN_FIRMS_MS = 1000;
const DELAY_BETWEEN_WEEKS_MS = 500;

async function main() {
  const weeksBack = Math.min(52, Math.max(1, parseInt(process.argv[2] || '', 10) || DEFAULT_WEEKS_BACK));
  const now = new Date();
  const { weekStart: currentWeekStart } = getWeekBounds(now);

  const weekRanges: Array<{ weekStart: Date; weekEnd: Date }> = [];
  for (let i = 1; i <= weeksBack; i++) {
    const monday = new Date(currentWeekStart);
    monday.setDate(currentWeekStart.getDate() - 7 * i);
    const { weekStart, weekEnd } = getWeekBounds(monday);
    weekRanges.push({ weekStart, weekEnd });
  }

  console.log('Backfill weekly_incidents');
  console.log('Firms:', TRUSTPILOT_FIRM_IDS.join(', '));
  console.log('Weeks:', weeksBack, '(most recent past week first)');
  console.log('');

  let totalIncidents = 0;
  for (const firmId of TRUSTPILOT_FIRM_IDS) {
    console.log(`Firm: ${firmId}`);
    for (let w = 0; w < weekRanges.length; w++) {
      const { weekStart, weekEnd } = weekRanges[w];
      const weekLabel = `${weekStart.toISOString().slice(0, 10)} – ${weekEnd.toISOString().slice(0, 10)}`;
      try {
        const incidents = await detectIncidents(firmId, weekStart, weekEnd);
        totalIncidents += incidents.length;
        if (incidents.length > 0) {
          console.log(`  ${weekLabel}: ${incidents.length} incident(s)`);
        }
        if (w < weekRanges.length - 1) {
          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_WEEKS_MS));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ${weekLabel}: ERROR – ${msg}`);
      }
    }
    if (firmId !== TRUSTPILOT_FIRM_IDS[TRUSTPILOT_FIRM_IDS.length - 1]) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_FIRMS_MS));
    }
  }

  console.log('');
  console.log('Done. Total incidents written:', totalIncidents);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
