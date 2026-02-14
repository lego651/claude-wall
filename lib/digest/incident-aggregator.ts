/**
 * TICKET-009: Incident Aggregator
 * Groups related reviews by category, generates AI incident summary, stores in weekly_incidents.
 * Phase 1 (Option B): spike-based (>=3 in 7d) + severity override (high_risk_allegation >=1 in 7d).
 * See docs/CLASSIFIER-TAXONOMY.md and lib/ai/classification-taxonomy.ts.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { getOpenAIClient } from '@/lib/ai/openai-client';
import { getWeekNumber, getYear } from './week-utils';
import {
  NEGATIVE_SPIKE_CATEGORIES,
  SEVERITY_OVERRIDE_CATEGORIES,
  MIN_REVIEWS_FOR_SPIKE_INCIDENT,
  MIN_REVIEWS_FOR_HIGH_RISK_INCIDENT,
  normalizeCategory,
} from '@/lib/ai/classification-taxonomy';

// All categories that can produce an incident (spike or severity override); includes legacy for query
const INCIDENT_QUERY_CATEGORIES = [
  ...NEGATIVE_SPIKE_CATEGORIES,
  ...SEVERITY_OVERRIDE_CATEGORIES,
  // Legacy equivalents so existing rows are included
  'payout_issue',
  'scam_warning',
  'platform_issue',
  'rule_violation',
];

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2 } as const;

export type IncidentType = (typeof NEGATIVE_SPIKE_CATEGORIES)[number] | (typeof SEVERITY_OVERRIDE_CATEGORIES)[number];

export interface IncidentInput {
  incident_type: IncidentType;
  severity: 'low' | 'medium' | 'high';
  title: string;
  summary: string;
  review_count: number;
  affected_users: string;
  review_ids: number[];
}

export interface DetectedIncident extends IncidentInput {
  firm_id: string;
  week_number: number;
  year: number;
}

type ReviewRow = {
  id: number;
  firm_id: string;
  category: string | null;
  severity: string | null;
  ai_summary: string | null;
};

/**
 * Fetch incident-eligible reviews in date range, group by normalized category,
 * create incidents: spike-based (>=3) for normal negative, severity override (>=1) for high_risk_allegation.
 */
export async function detectIncidents(
  firmId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<DetectedIncident[]> {
  const supabase = createServiceClient();
  const weekNumber = getWeekNumber(weekStart);
  const year = getYear(weekStart);

  const startStr = weekStart.toISOString().slice(0, 10);
  const endStr = weekEnd.toISOString().slice(0, 10);

  const { data: reviews, error } = await supabase
    .from('trustpilot_reviews')
    .select('id, firm_id, category, severity, ai_summary')
    .eq('firm_id', firmId)
    .gte('review_date', startStr)
    .lte('review_date', endStr)
    .in('category', INCIDENT_QUERY_CATEGORIES);

  if (error) throw new Error(`Failed to fetch reviews: ${error.message}`);
  if (!reviews?.length) return [];

  const byNormalizedCategory = new Map<string, ReviewRow[]>();
  for (const r of reviews as ReviewRow[]) {
    const cat = r.category ?? null;
    const norm = normalizeCategory(cat);
    if (!norm) continue;
    if (!byNormalizedCategory.has(norm)) byNormalizedCategory.set(norm, []);
    byNormalizedCategory.get(norm)!.push(r);
  }

  const incidents: DetectedIncident[] = [];
  const isHighRisk = (c: string) => (SEVERITY_OVERRIDE_CATEGORIES as readonly string[]).includes(c);

  for (const [normCategory, group] of byNormalizedCategory) {
    const minRequired = isHighRisk(normCategory)
      ? MIN_REVIEWS_FOR_HIGH_RISK_INCIDENT
      : MIN_REVIEWS_FOR_SPIKE_INCIDENT;
    if (group.length < minRequired) continue;

    const reviewIds = group.map((r) => r.id);
    const summaries = group.map((r) => r.ai_summary ?? '(no summary)').filter(Boolean);
    const maxSeverity = deriveSeverity(group);

    const { title, summary, affected_users } = await generateIncidentSummary(
      normCategory,
      summaries,
      group.length
    );

    incidents.push({
      firm_id: firmId,
      week_number: weekNumber,
      year,
      incident_type: normCategory as IncidentType,
      severity: maxSeverity,
      title,
      summary,
      review_count: group.length,
      affected_users,
      review_ids: reviewIds,
    });
  }

  await storeIncidents(incidents);
  return incidents;
}

function deriveSeverity(group: ReviewRow[]): 'low' | 'medium' | 'high' {
  let max = 0;
  for (const r of group) {
    const s = r.severity as keyof typeof SEVERITY_ORDER | null;
    if (s && s in SEVERITY_ORDER) max = Math.max(max, SEVERITY_ORDER[s]);
  }
  if (max >= SEVERITY_ORDER.high) return 'high';
  if (max >= SEVERITY_ORDER.medium) return 'medium';
  return 'low';
}

async function generateIncidentSummary(
  incidentType: string,
  reviewSummaries: string[],
  reviewCount: number
): Promise<{ title: string; summary: string; affected_users: string }> {
  const openai = getOpenAIClient();
  const prompt = `You are summarizing a cluster of Trustpilot reviews for a prop trading firm. All reviews fall under the same issue type: "${incidentType}".

Review count: ${reviewCount}

Individual review summaries (from AI classification):
${reviewSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Respond with valid JSON only, no markdown:
{
  "title": "Short headline (e.g. 'Crypto payout delays reported')",
  "summary": "2-3 sentence aggregated summary of what users reported",
  "affected_users": "Estimate like '~10-15' or '~5-8' based on review count and content"
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty AI response for incident summary');
  const parsed = JSON.parse(raw) as { title?: string; summary?: string; affected_users?: string };
  return {
    title: String(parsed.title ?? 'Incident').slice(0, 500),
    summary: String(parsed.summary ?? '').slice(0, 2000),
    affected_users: String(parsed.affected_users ?? `~${reviewCount}`).slice(0, 100),
  };
}

async function storeIncidents(incidents: DetectedIncident[]): Promise<void> {
  if (!incidents.length) return;
  const supabase = createServiceClient();
  const first = incidents[0];
  await supabase
    .from('weekly_incidents')
    .delete()
    .eq('firm_id', first.firm_id)
    .eq('week_number', first.week_number)
    .eq('year', first.year);
  const rows = incidents.map((i) => ({
    firm_id: i.firm_id,
    week_number: i.week_number,
    year: i.year,
    incident_type: i.incident_type,
    severity: i.severity,
    title: i.title,
    summary: i.summary,
    review_count: i.review_count,
    affected_users: i.affected_users,
    review_ids: i.review_ids,
  }));
  const { error } = await supabase.from('weekly_incidents').insert(rows);
  if (error) throw new Error(`Failed to store incidents: ${error.message}`);
}
