/**
 * TICKET-010: Weekly Report Generator
 * Compiles payout summary, Trustpilot summary, incidents, and AI "Our Take"; stores in firm_weekly_reports.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getOpenAIClient } from '@/lib/ai/openai-client';
import { type DetectedIncident } from './incident-aggregator';
import { getWeekNumberUtc, getYearUtc, getWeekBoundsUtc } from './week-utils';
import { loadMonthlyData } from '@/lib/services/payoutDataLoader';
import {
  NEGATIVE_SENTIMENT_CATEGORIES,
  POSITIVE_SENTIMENT_CATEGORY,
  NEUTRAL_SENTIMENT_CATEGORY,
  LEGACY_CATEGORY_MAP,
} from '@/lib/ai/classification-taxonomy';

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

/** Shape of monthly payout JSON from payoutDataLoader */
interface MonthlyPayoutData {
  transactions?: Array<{ amount?: number; timestamp?: string }>;
}

function getYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function getPayoutSummaryForRange(
  firmId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{ total: number; count: number; largest: number; avgPayout: number }> {
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
    const data = (await loadMonthlyData(firmId, yearMonth)) as MonthlyPayoutData | null;
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
    .from('firm_trustpilot_reviews')
    .select('rating, category')
    .eq('firm_id', firmId)
    .gte('review_date', startStr)
    .lte('review_date', endStr);

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
  const list = (reviews ?? []) as Array<{ rating: number; category: string | null }>;
  const avgRating = list.length > 0 ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  return { reviews: list, avgRating };
}

/** True if category counts as negative for digest (new or legacy) */
function isNegativeSentiment(category: string | null): boolean {
  if (!category) return false;
  const norm = LEGACY_CATEGORY_MAP[category] ?? category;
  return (NEGATIVE_SENTIMENT_CATEGORIES as readonly string[]).includes(norm);
}

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
  const weekNumber = getWeekNumberUtc(weekStart);
  const year = getYearUtc(weekStart);

  const payoutThis = await getPayoutSummaryForRange(firmId, weekStart, weekEnd);
  const prevBounds = getWeekBoundsUtc(new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000));
  const payoutPrev = await getPayoutSummaryForRange(firmId, prevBounds.weekStart, prevBounds.weekEnd);
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
    positive: reviews.filter(
      (r) => r.category === POSITIVE_SENTIMENT_CATEGORY || r.category === 'positive'
    ).length,
    neutral: reviews.filter(
      (r) => r.category === NEUTRAL_SENTIMENT_CATEGORY || r.category === 'neutral'
    ).length,
    negative: reviews.filter((r) => isNegativeSentiment(r.category)).length,
  };

  const trustpilot: TrustpilotSummary = {
    avgRating,
    ratingChange,
    reviewCount: reviews.length,
    sentiment,
  };

  // Get published incidents for this week (filtered by published=true for digest)
  const supabase = createServiceClient();
  const { data: incidentsData, error: incidentsError } = await supabase
    .from('firm_daily_incidents')
    .select('*')
    .eq('firm_id', firmId)
    .eq('week_number', weekNumber)
    .eq('year', year)
    .eq('published', true) // Only include approved incidents in digest
    .order('created_at', { ascending: false });

  if (incidentsError) {
    console.error('[Generator] Failed to fetch published incidents:', incidentsError);
  }

  const incidents = (incidentsData || []).map(inc => ({
    incident_type: inc.incident_type,
    severity: inc.severity,
    title: inc.title,
    summary: inc.summary,
    review_count: inc.review_count,
  })) as unknown as DetectedIncident[];

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

  const weekFromDate = weekStart.toISOString().slice(0, 10);
  const weekToDate = weekEnd.toISOString().slice(0, 10);
  await supabase.from('firm_weekly_reports').upsert(
    {
      firm_id: firmId,
      week_from_date: weekFromDate,
      week_to_date: weekToDate,
      report_json: reportJson,
    },
    { onConflict: 'firm_id,week_from_date' }
  );

  return reportJson;
}
