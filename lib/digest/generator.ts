/**
 * TICKET-010: Weekly Report Generator
 * Compiles payout summary, Trustpilot summary, incidents, and AI "Our Take"; stores in weekly_reports.
 */

import { createServiceClient } from '@/libs/supabase/service';
import { getOpenAIClient } from '@/lib/ai/openai-client';
import { detectIncidents, type DetectedIncident } from './incident-aggregator';
import { getWeekNumber, getYear, getWeekBounds } from './week-utils';
import { loadMonthlyData } from '@/lib/services/payoutDataLoader';

// ============================================================================
// TYPES
// ============================================================================

export interface PayoutSummary {
  total: number;
  count: number;
  largest: number;
  avgPayout: number;
  changeVsLastWeek: number | null; // % or absolute; null if no previous week data
}

export interface TrustpilotSummary {
  avgRating: number;
  ratingChange: number | null;
  reviewCount: number;
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface WeeklyReportJson {
  firmId: string;
  weekNumber: number;
  year: number;
  weekStart: string;
  weekEnd: string;
  payouts: PayoutSummary;
  trustpilot: TrustpilotSummary;
  incidents: DetectedIncident[];
  ourTake: string;
  generatedAt: string;
}

// ============================================================================
// PAYOUT SUMMARY FOR DATE RANGE (from JSON files)
// ============================================================================

function getYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getPayoutSummaryForRange(
  firmId: string,
  weekStart: Date,
  weekEnd: Date
): { total: number; count: number; largest: number; avgPayout: number } {
  const startTime = weekStart.toISOString();
  const endTime = weekEnd.toISOString();

  const months = new Set<string>();
  const d = new Date(weekStart);
  while (d <= weekEnd) {
    months.add(getYearMonth(d));
    d.setDate(d.getDate() + 1);
  }

  const allTransactions: Array<{ amount: number; timestamp: string }> = [];
  for (const yearMonth of months) {
    const data = loadMonthlyData(firmId, yearMonth);
    if (data?.transactions) {
      for (const t of data.transactions) {
        const ts = t.timestamp ?? '';
        if (ts >= startTime && ts <= endTime) allTransactions.push({ amount: t.amount ?? 0, timestamp: ts });
      }
    }
  }

  const total = allTransactions.reduce((s, t) => s + t.amount, 0);
  const count = allTransactions.length;
  const largest = count > 0 ? Math.max(...allTransactions.map((t) => t.amount)) : 0;
  const avgPayout = count > 0 ? Math.round(total / count) : 0;
  return { total, count, largest, avgPayout };
}

// ============================================================================
// REVIEWS + SENTIMENT
// ============================================================================

async function getReviewsAndSentiment(
  firmId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{ reviews: Array<{ rating: number; category: string | null }>; avgRating: number }> {
  const supabase = createServiceClient();
  const startStr = weekStart.toISOString().slice(0, 10);
  const endStr = weekEnd.toISOString().slice(0, 10);

  const { data: reviews, error } = await supabase
    .from('trustpilot_reviews')
    .select('rating, category')
    .eq('firm_id', firmId)
    .gte('review_date', startStr)
    .lte('review_date', endStr);

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
  const list = (reviews ?? []) as Array<{ rating: number; category: string | null }>;
  const avgRating = list.length > 0 ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return { reviews: list, avgRating };
}

const NEGATIVE_CATEGORIES = ['payout_issue', 'scam_warning', 'platform_issue', 'rule_violation'];

// ============================================================================
// AI OUR TAKE
// ============================================================================

async function generateOurTake(
  firmId: string,
  payoutSummary: PayoutSummary,
  trustpilot: TrustpilotSummary,
  incidents: DetectedIncident[]
): Promise<string> {
  const openai = getOpenAIClient();
  const incidentBlurb =
    incidents.length === 0
      ? 'No notable incidents this week.'
      : incidents.map((i) => `- ${i.title} (${i.incident_type}, ${i.review_count} reviews)`).join('\n');

  const prompt = `You are writing the "Our Take" section (2-3 short paragraphs) for a weekly intelligence report on a prop trading firm. Be concise and neutral.

Firm: ${firmId}

This week's data:
- Payouts: ${payoutSummary.count} payouts, total $${payoutSummary.total.toLocaleString()}, largest $${payoutSummary.largest.toLocaleString()}, avg $${payoutSummary.avgPayout.toLocaleString()}${payoutSummary.changeVsLastWeek != null ? `, change vs last week: ${payoutSummary.changeVsLastWeek}%` : ''}
- Trustpilot: ${trustpilot.reviewCount} reviews, avg rating ${trustpilot.avgRating.toFixed(1)}/5${trustpilot.ratingChange != null ? `, change ${trustpilot.ratingChange >= 0 ? '+' : ''}${trustpilot.ratingChange.toFixed(1)}` : ''}
- Sentiment: ${trustpilot.sentiment.positive} positive, ${trustpilot.sentiment.neutral} neutral, ${trustpilot.sentiment.negative} negative
- Incidents: ${incidentBlurb}

Write 2-3 paragraphs: brief summary of payouts and sentiment, then any notable incidents and a short recommendation (e.g. "proceed with caution" or "no red flags"). No bullet points. Plain prose.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? '';
  return text.slice(0, 2000);
}

// ============================================================================
// MAIN
// ============================================================================

/**
 * Generate weekly report for a firm and week. Fetches payouts (from JSON), reviews, incidents;
 * computes summaries; generates AI "Our Take"; stores in weekly_reports. Returns report JSON.
 */
export async function generateWeeklyReport(
  firmId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyReportJson> {
  const weekNumber = getWeekNumber(weekStart);
  const year = getYear(weekStart);

  const payoutThis = getPayoutSummaryForRange(firmId, weekStart, weekEnd);
  const prevBounds = getWeekBounds(new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
  const payoutPrev = getPayoutSummaryForRange(firmId, prevBounds.weekStart, prevBounds.weekEnd);
  const changeVsLastWeek =
    payoutPrev.total > 0
      ? Math.round(((payoutThis.total - payoutPrev.total) / payoutPrev.total) * 100)
      : null;

  const payouts: PayoutSummary = {
    ...payoutThis,
    changeVsLastWeek,
  };

  const { reviews, avgRating } = await getReviewsAndSentiment(firmId, weekStart, weekEnd);
  const prevReviews = await getReviewsAndSentiment(firmId, prevBounds.weekStart, prevBounds.weekEnd);
  const ratingChange = prevReviews.reviews.length > 0 ? avgRating - prevReviews.avgRating : null;

  const sentiment = {
    positive: reviews.filter((r) => r.category === 'positive').length,
    neutral: reviews.filter((r) => r.category === 'neutral').length,
    negative: reviews.filter((r) => r.category && NEGATIVE_CATEGORIES.includes(r.category)).length,
  };

  const trustpilot: TrustpilotSummary = {
    avgRating,
    ratingChange,
    reviewCount: reviews.length,
    sentiment,
  };

  const incidents = await detectIncidents(firmId, weekStart, weekEnd);
  const ourTake = await generateOurTake(firmId, payouts, trustpilot, incidents);

  const reportJson: WeeklyReportJson = {
    firmId,
    weekNumber,
    year,
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    payouts,
    trustpilot,
    incidents,
    ourTake,
    generatedAt: new Date().toISOString(),
  };

  const supabase = createServiceClient();
  await supabase.from('weekly_reports').upsert(
    {
      firm_id: firmId,
      week_number: weekNumber,
      year,
      report_json: reportJson,
    },
    { onConflict: 'firm_id,week_number,year' }
  );

  return reportJson;
}
