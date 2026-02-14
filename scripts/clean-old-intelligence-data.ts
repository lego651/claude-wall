/**
 * Clean old intelligence data: keep last 7 days of trustpilot_reviews,
 * last 30 days of weekly_incidents and weekly_reports.
 *
 * Run: npx tsx scripts/clean-old-intelligence-data.ts
 *
 * Requires: .env with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { createServiceClient } from '@/lib/supabase/service';

const TRUSTPILOT_RETAIN_DAYS = 7;
const INCIDENTS_RETAIN_DAYS = 30;
const REPORTS_RETAIN_DAYS = 30;

async function main() {
  const supabase = createServiceClient();

  const now = new Date();

  const reviewCutoff = new Date(now);
  reviewCutoff.setDate(reviewCutoff.getDate() - TRUSTPILOT_RETAIN_DAYS);
  const reviewCutoffStr = reviewCutoff.toISOString().slice(0, 10);

  const incidentsCutoff = new Date(now);
  incidentsCutoff.setDate(incidentsCutoff.getDate() - INCIDENTS_RETAIN_DAYS);
  const incidentsCutoffISO = incidentsCutoff.toISOString();

  const reportsCutoff = new Date(now);
  reportsCutoff.setDate(reportsCutoff.getDate() - REPORTS_RETAIN_DAYS);
  const reportsCutoffISO = reportsCutoff.toISOString();

  console.log('Clean old intelligence data');
  console.log('  trustpilot_reviews: keep review_date >=', reviewCutoffStr);
  console.log('  weekly_incidents:   keep created_at >=', incidentsCutoffISO.slice(0, 10));
  console.log('  weekly_reports:    keep generated_at >=', reportsCutoffISO.slice(0, 10));
  console.log('');

  const { data: delReviews, error: errReviews } = await supabase
    .from('trustpilot_reviews')
    .delete()
    .lt('review_date', reviewCutoffStr)
    .select('id');

  if (errReviews) {
    console.error('trustpilot_reviews delete error:', errReviews.message);
  } else {
    const count = (delReviews || []).length;
    console.log('  trustpilot_reviews: deleted', count, 'row(s)');
  }

  const { data: delIncidents, error: errIncidents } = await supabase
    .from('weekly_incidents')
    .delete()
    .lt('created_at', incidentsCutoffISO)
    .select('id');

  if (errIncidents) {
    console.error('weekly_incidents delete error:', errIncidents.message);
  } else {
    const count = (delIncidents || []).length;
    console.log('  weekly_incidents:   deleted', count, 'row(s)');
  }

  const { data: delReports, error: errReports } = await supabase
    .from('weekly_reports')
    .delete()
    .lt('generated_at', reportsCutoffISO)
    .select('id');

  if (errReports) {
    console.error('weekly_reports delete error:', errReports.message);
  } else {
    const count = (delReports || []).length;
    console.log('  weekly_reports:    deleted', count, 'row(s)');
  }

  console.log('');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
