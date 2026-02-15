/**
 * Delete firm_daily_incidents (and optionally firm_weekly_reports) older than February 2026.
 * Keeps week 5 of 2026 onward (week 5 = Jan 26–Feb 1, so Feb 1+ is kept).
 *
 * Usage:
 *   npx tsx scripts/delete-firm-incidents-before-feb.ts           # dry-run (counts only)
 *   npx tsx scripts/delete-firm-incidents-before-feb.ts --execute # actually delete
 *
 * Env (from .env at project root):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const CUTOFF_YEAR = 2026;
const CUTOFF_WEEK = 5; // first week that includes Feb (Jan 26–Feb 1)
const WEEK_TO_DATE_CUTOFF = '2026-02-01';

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  if (!execute) {
    console.log('Dry run (no deletes). Use --execute to delete.');
  }

  const supabase = createServiceClient();

  // firm_daily_incidents: delete where year < 2026 OR (year = 2026 AND week_number < 5)
  const { count: countOldYears } = await supabase
    .from('firm_daily_incidents')
    .select('*', { count: 'exact', head: true })
    .lt('year', CUTOFF_YEAR);

  const { count: countOldWeeks2026 } = await supabase
    .from('firm_daily_incidents')
    .select('*', { count: 'exact', head: true })
    .eq('year', CUTOFF_YEAR)
    .lt('week_number', CUTOFF_WEEK);

  const totalIncidents = (countOldYears ?? 0) + (countOldWeeks2026 ?? 0);
  console.log(`firm_daily_incidents: ${totalIncidents} rows to delete (year < ${CUTOFF_YEAR}: ${countOldYears ?? 0}, ${CUTOFF_YEAR} week < ${CUTOFF_WEEK}: ${countOldWeeks2026 ?? 0})`);

  if (execute && totalIncidents > 0) {
    const { error: e1 } = await supabase
      .from('firm_daily_incidents')
      .delete()
      .lt('year', CUTOFF_YEAR);
    if (e1) {
      console.error('Delete firm_daily_incidents (year < 2026):', e1);
      process.exit(1);
    }
    const { error: e2 } = await supabase
      .from('firm_daily_incidents')
      .delete()
      .eq('year', CUTOFF_YEAR)
      .lt('week_number', CUTOFF_WEEK);
    if (e2) {
      console.error('Delete firm_daily_incidents (2026 week < 5):', e2);
      process.exit(1);
    }
    console.log('Deleted firm_daily_incidents.');
  }

  // firm_weekly_reports: delete where week_to_date < 2026-02-01
  const { count: countReports } = await supabase
    .from('firm_weekly_reports')
    .select('*', { count: 'exact', head: true })
    .lt('week_to_date', WEEK_TO_DATE_CUTOFF);

  console.log(`firm_weekly_reports: ${countReports ?? 0} rows to delete (week_to_date < ${WEEK_TO_DATE_CUTOFF})`);

  if (execute && (countReports ?? 0) > 0) {
    const { error: e3 } = await supabase
      .from('firm_weekly_reports')
      .delete()
      .lt('week_to_date', WEEK_TO_DATE_CUTOFF);
    if (e3) {
      console.error('Delete firm_weekly_reports:', e3);
      process.exit(1);
    }
    console.log('Deleted firm_weekly_reports.');
  }

  if (!execute) {
    console.log('Done (dry run). Run with --execute to apply.');
  } else {
    console.log('Done.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
