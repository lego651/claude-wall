/**
 * S10-010: Detect Trustpilot score deviation over consecutive weeks.
 *
 * When a firm's weekly avg Trustpilot rating deviates more than DEVIATION_THRESHOLD
 * from its overall (lifetime) score for 2+ consecutive weeks, generates an intelligence
 * signal to surface in the feed.
 *
 * Signal is merged into the firm_daily_incidents batch by detectIncidents()
 * in incident-aggregator.ts so it persists alongside review-based signals.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getWeekNumberUtc, getYearUtc } from './week-utils';
import type { DetectedIncident } from './incident-aggregator';

const DEVIATION_THRESHOLD = 0.5;

/**
 * Returns a DetectedIncident if the firm's weekly Trustpilot avg has deviated
 * more than DEVIATION_THRESHOLD from its overall score for 2 consecutive weeks.
 * Returns null if the condition is not met or data is insufficient.
 */
export async function detectTrustpilotScoreTrendIncident(
  firmId: string,
  weekStart: Date,
): Promise<DetectedIncident | null> {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('firm_profiles')
    .select('trustpilot_overall_score')
    .eq('id', firmId)
    .single();

  const overallScore: number | null = (profile?.trustpilot_overall_score as number | null | undefined) ?? null;
  if (overallScore == null) return null;

  // Fetch the 2 most recent weekly reports (includes current week if already generated)
  const { data: reports } = await supabase
    .from('firm_weekly_reports')
    .select('week_from_date, report_json')
    .eq('firm_id', firmId)
    .order('week_from_date', { ascending: false })
    .limit(2);

  if (!reports || reports.length < 2) return null;

  const [current, prior] = reports as Array<{ week_from_date: string; report_json: Record<string, unknown> }>;
  const currentAvg = (current.report_json?.trustpilot as Record<string, unknown> | undefined)?.avgRating as number | undefined;
  const priorAvg = (prior.report_json?.trustpilot as Record<string, unknown> | undefined)?.avgRating as number | undefined;

  if (currentAvg == null || priorAvg == null) return null;

  const currentDelta = currentAvg - overallScore;
  const priorDelta = priorAvg - overallScore;

  const bothExceedThreshold =
    Math.abs(currentDelta) > DEVIATION_THRESHOLD &&
    Math.abs(priorDelta) > DEVIATION_THRESHOLD &&
    Math.sign(currentDelta) === Math.sign(priorDelta);

  if (!bothExceedThreshold) return null;

  const declining = currentDelta < 0;
  const weekNumber = getWeekNumberUtc(weekStart);
  const year = getYearUtc(weekStart);
  const reviewCount = ((current.report_json?.trustpilot as Record<string, unknown> | undefined)?.reviewCount as number | undefined) ?? 0;

  return {
    firm_id: firmId,
    week_number: weekNumber,
    year,
    incident_type: 'trustpilot_score_trend' as DetectedIncident['incident_type'],
    severity: declining ? 'high' : 'medium',
    title: declining
      ? 'Trustpilot Score Declining — 2nd Consecutive Week Below Average'
      : 'Trustpilot Score Improving — 2nd Consecutive Week Above Average',
    summary: declining
      ? `Weekly Trustpilot avg (${currentAvg.toFixed(1)}) has been below the overall score (${overallScore.toFixed(1)}) for 2 consecutive weeks. This may indicate emerging operational issues.`
      : `Weekly Trustpilot avg (${currentAvg.toFixed(1)}) has been above the overall score (${overallScore.toFixed(1)}) for 2 consecutive weeks. Positive momentum in trader sentiment.`,
    review_count: reviewCount,
    affected_users: '—',
    review_ids: [],
  };
}
