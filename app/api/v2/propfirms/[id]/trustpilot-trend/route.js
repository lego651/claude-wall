/**
 * GET /api/v2/propfirms/[id]/trustpilot-trend
 *
 * Returns the last 8 weeks of weekly Trustpilot avg ratings plus the firm's
 * overall lifetime score scraped from the Trustpilot page.
 * Powers the score momentum sparkline on the intelligence sidebar (S10-009).
 *
 * Response shape:
 * {
 *   overall_score: number | null,
 *   overall_review_count: number | null,
 *   weeks: Array<{
 *     week_from: string,   // YYYY-MM-DD
 *     week_to: string,     // YYYY-MM-DD
 *     avg_rating: number | null,
 *     review_count: number | null,
 *     rating_change: number | null,
 *   }>
 * }
 *
 * Returns { overall_score: null, overall_review_count: null, weeks: [] } when no data.
 * Public route — no auth required.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const WEEKS_LIMIT = 8;

function createSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(_request, { params }) {
  const { id: firmId } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createSupabaseClient();

  try {
    // Fetch firm overall score and last payout timestamp
    const { data: profile, error: profileError } = await supabase
      .from('firm_profiles')
      .select('trustpilot_overall_score, trustpilot_overall_review_count, last_payout_at')
      .eq('id', firmId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch firm profile' }, { status: 500 });
    }

    // Fetch last 8 weekly reports ordered newest first
    const { data: reports, error: reportsError } = await supabase
      .from('firm_weekly_reports')
      .select('week_from_date, week_to_date, report_json')
      .eq('firm_id', firmId)
      .order('week_from_date', { ascending: false })
      .limit(WEEKS_LIMIT);

    if (reportsError) {
      return NextResponse.json({ error: 'Failed to fetch weekly reports' }, { status: 500 });
    }

    const weeks = (reports ?? []).map((row) => {
      const tp = row.report_json?.trustpilot ?? {};
      const payout = row.report_json?.payouts ?? {};
      return {
        week_from: row.week_from_date,
        week_to: row.week_to_date,
        avg_rating: tp.avgRating ?? null,
        review_count: tp.reviewCount ?? null,
        rating_change: tp.ratingChange ?? null,
        payout_total: payout.total ?? null,
        payout_count: payout.count ?? null,
      };
    });

    // Derive consecutive days not paid from last_payout_at.
    // This is simpler and more reliable than scanning firm_recent_payouts
    // (which is a short-window real-time table, not a full history).
    const lastPayoutAt = profile?.last_payout_at;
    const consecutiveDaysNotPaid = lastPayoutAt
      ? Math.floor((Date.now() - new Date(lastPayoutAt).getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    return NextResponse.json({
      overall_score: profile?.trustpilot_overall_score ?? null,
      overall_review_count: profile?.trustpilot_overall_review_count ?? null,
      weeks,
      payout_daily: { consecutive_days_not_paid: consecutiveDaysNotPaid },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
