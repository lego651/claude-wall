/**
 * TICKET-009: Run incident aggregator for a firm and week.
 *
 * Run: npx tsx scripts/run-incident-aggregator.ts [firmId] [weekStartYYYY-MM-DD]
 * Example: npx tsx scripts/run-incident-aggregator.ts fundednext 2026-01-22
 *
 * Requires: .env with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { detectIncidents } from '../lib/digest/incident-aggregator';
import { getWeekBounds } from '../lib/digest/week-utils';

async function main() {
  const firmId = process.argv[2] ?? 'fundednext';
  const weekStartArg = process.argv[3]; // e.g. 2026-01-22 (Monday)
  const weekStart = weekStartArg
    ? new Date(weekStartArg + 'T00:00:00Z')
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
      })();
  const { weekStart: start, weekEnd: end } = getWeekBounds(weekStart);

  console.log('TICKET-009: Incident Aggregator');
  console.log('Firm:', firmId);
  console.log('Week:', start.toISOString().slice(0, 10), '–', end.toISOString().slice(0, 10));
  console.log('');

  const incidents = await detectIncidents(firmId, start, end);
  console.log('Incidents detected:', incidents.length);
  incidents.forEach((i) => {
    console.log(`  - [${i.incident_type}] ${i.title} (${i.review_count} reviews, ${i.severity})`);
  });
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
