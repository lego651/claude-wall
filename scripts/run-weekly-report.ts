/**
 * TICKET-010: Generate weekly report for a firm and week.
 *
 * Run: npx tsx scripts/run-weekly-report.ts [firmId] [weekStartYYYY-MM-DD]
 * Example: npx tsx scripts/run-weekly-report.ts fundednext 2026-01-27
 *
 * Requires: .env with OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { generateWeeklyReport } from '../lib/digest/generator';
import { getWeekBounds } from '../lib/digest/week-utils';

async function main() {
  const firmId = process.argv[2] ?? 'fundednext';
  const weekStartArg = process.argv[3];
  const weekStart = weekStartArg
    ? new Date(weekStartArg + 'T00:00:00Z')
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
      })();
  const { weekStart: start, weekEnd: end } = getWeekBounds(weekStart);

  console.log('TICKET-010: Weekly Report Generator');
  console.log('Firm:', firmId);
  console.log('Week:', start.toISOString().slice(0, 10), '–', end.toISOString().slice(0, 10));
  console.log('');

  const report = await generateWeeklyReport(firmId, start, end);

  console.log('Report generated and stored in weekly_reports.');
  console.log('Payouts:', report.payouts.count, 'payouts, total $' + report.payouts.total.toLocaleString());
  console.log('Trustpilot:', report.trustpilot.reviewCount, 'reviews, avg', report.trustpilot.avgRating.toFixed(1));
  console.log('Incidents:', report.incidents.length);
  console.log('Our Take (preview):', report.ourTake.slice(0, 200) + '...');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
