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

/** Max incidents per OpenAI call (batch). */
const INCIDENT_SUMMARY_BATCH_SIZE = 10;

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

  const isHighRisk = (c: string) => (SEVERITY_OVERRIDE_CATEGORIES as readonly string[]).includes(c);

  interface PendingIncident {
    normCategory: string;
    group: ReviewRow[];
    reviewIds: number[];
    summaries: string[];
    maxSeverity: 'low' | 'medium' | 'high';
  }

  const pending: PendingIncident[] = [];
  for (const [normCategory, group] of byNormalizedCategory) {
    const minRequired = isHighRisk(normCategory)
      ? MIN_REVIEWS_FOR_HIGH_RISK_INCIDENT
      : MIN_REVIEWS_FOR_SPIKE_INCIDENT;
    if (group.length < minRequired) continue;

    pending.push({
      normCategory,
      group,
      reviewIds: group.map((r) => r.id),
      summaries: group.map((r) => r.ai_summary ?? '(no summary)').filter(Boolean),
      maxSeverity: deriveSeverity(group),
    });
  }

  if (pending.length === 0) return [];

  const incidents: DetectedIncident[] = [];
  for (let i = 0; i < pending.length; i += INCIDENT_SUMMARY_BATCH_SIZE) {
    const chunk = pending.slice(i, i + INCIDENT_SUMMARY_BATCH_SIZE);
    const batchInputs = chunk.map((p) => ({
      incidentType: p.normCategory,
      reviewSummaries: p.summaries,
      reviewCount: p.group.length,
    }));
    const batchResults = await generateIncidentSummariesBatch(batchInputs);
    for (let j = 0; j < chunk.length; j++) {
      const p = chunk[j];
      const res = batchResults[j];
      if (!res) continue;
      incidents.push({
        firm_id: firmId,
        week_number: weekNumber,
        year,
        incident_type: p.normCategory as IncidentType,
        severity: p.maxSeverity,
        title: res.title,
        summary: res.summary,
        review_count: p.group.length,
        affected_users: res.affected_users,
        review_ids: p.reviewIds,
      });
    }
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

export interface IncidentSummaryInput {
  incidentType: string;
  reviewSummaries: string[];
  reviewCount: number;
}

export interface IncidentSummaryResult {
  title: string;
  summary: string;
  affected_users: string;
}

/**
 * Generate title/summary/affected_users for multiple incidents in one OpenAI call.
 */
async function generateIncidentSummariesBatch(
  items: IncidentSummaryInput[]
): Promise<IncidentSummaryResult[]> {
  if (items.length === 0) return [];

  const openai = getOpenAIClient();
  const parts = items.map(
    (it, idx) =>
      `--- Incident ${idx + 1} (type: ${it.incidentType}, review_count: ${it.reviewCount}) ---\n` +
      it.reviewSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')
  );
  const prompt = `You are summarizing clusters of Trustpilot reviews for a prop trading firm. There are exactly ${items.length} incident clusters below. For each cluster, produce:
- title: Short headline (max 80 chars), e.g. "Crypto payout delays reported"
- summary: 2-3 sentence aggregated summary (max 300 chars)
- affected_users: Estimate like "~10-15" or "~5-8" based on review count

Respond with a JSON object with one key "results" whose value is an array of exactly ${items.length} objects, each: {"title":"...","summary":"...","affected_users":"..."} in the same order as the clusters (index 0 = Incident 1, etc.). No other text.`;

  const fullContent = prompt + '\n\n' + parts.join('\n\n');
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: fullContent }],
    temperature: 0.2,
    max_tokens: Math.min(4096, 400 * items.length),
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty AI response for incident summaries batch');
  const parsed = JSON.parse(raw) as { results?: Array<{ title?: string; summary?: string; affected_users?: string }> };
  const arr = Array.isArray(parsed?.results) ? parsed.results : null;
  if (!arr || arr.length < items.length) {
    throw new Error(`Expected at least ${items.length} results, got ${arr?.length ?? 0}`);
  }

  return arr.slice(0, items.length).map((o, idx) => {
    const reviewCount = items[idx].reviewCount;
    return {
      title: String(o?.title ?? 'Incident').slice(0, 500),
      summary: String(o?.summary ?? '').slice(0, 2000),
      affected_users: String(o?.affected_users ?? `~${reviewCount}`).slice(0, 100),
    };
  });
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
