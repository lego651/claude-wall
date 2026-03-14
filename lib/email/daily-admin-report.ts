/**
 * Daily Admin Report Email
 * S12-006: Core module for building and rendering the daily admin report email.
 *
 * Exports:
 *   buildDailyAdminReport() — main entry point, returns { subject, html }
 *   fetchReportData()       — queries DB for pipeline health, zero-payout firms, content
 *   renderReportHtml(data)  — pure function, returns inline-styled HTML string
 */

import {
  SCRAPER_STALE_HOURS,
  CLASSIFIER_BACKLOG_THRESHOLD,
  PIPELINE_ERROR_THRESHOLD,
  PAYOUT_ZERO_FIRM_MIN_AGE_DAYS,
} from '@/lib/alert-rules';
import { createServiceClient } from '@/lib/supabase/service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineStatus = 'ok' | 'warning' | 'critical';

export interface PipelineHealth {
  jobName: string;
  displayName: string;
  lastRunAt: string | null;
  status: PipelineStatus;
  stats: Record<string, number>;
}

export interface ReportData {
  pipelines: PipelineHealth[];
  zeroPayoutFirms: string[];
  staleClassifierBacklog: number;
  newContent: {
    total: number;
    byType: Record<string, number>;
    firmNames: string[];
  };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Pipeline definitions
// ---------------------------------------------------------------------------

const PIPELINE_DEFS: Array<{ jobName: string; displayName: string }> = [
  { jobName: 'trustpilot_scraper', displayName: 'Daily 1: Scrape' },
  { jobName: 'classify_reviews', displayName: 'Daily 2: Classify' },
  { jobName: 'incident_detector', displayName: 'Daily 3: Incidents' },
  { jobName: 'ingest-firm-emails', displayName: 'Email Ingest' },
];

// ---------------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------------

function computePipelineStatus(lastRunAt: string | null, errors: number): PipelineStatus {
  if (lastRunAt === null) return 'critical';

  const ageMs = Date.now() - new Date(lastRunAt).getTime();

  if (ageMs > SCRAPER_STALE_HOURS * 3600 * 1000) return 'critical';
  if (errors > PIPELINE_ERROR_THRESHOLD) return 'critical';
  if (ageMs > 12 * 3600 * 1000) return 'warning';
  return 'ok';
}

// ---------------------------------------------------------------------------
// fetchReportData
// ---------------------------------------------------------------------------

export async function fetchReportData(): Promise<ReportData> {
  const supabase = createServiceClient();

  // ── 1. Pipeline health from cron_last_run ────────────────────────────────
  const jobNames = PIPELINE_DEFS.map((p) => p.jobName);

  const { data: cronRows } = await supabase
    .from('cron_last_run')
    .select('job_name, last_run_at, result_json')
    .in('job_name', jobNames);

  const cronByJob = new Map<string, { last_run_at: string | null; result_json: Record<string, unknown> | null }>();
  for (const row of cronRows ?? []) {
    cronByJob.set(row.job_name, {
      last_run_at: row.last_run_at ?? null,
      result_json: (row.result_json as Record<string, unknown> | null) ?? null,
    });
  }

  const pipelines: PipelineHealth[] = PIPELINE_DEFS.map(({ jobName, displayName }) => {
    const row = cronByJob.get(jobName);
    const lastRunAt = row?.last_run_at ?? null;
    const rj = row?.result_json ?? {};
    const errors = (rj?.errors as number | undefined) ?? 0;
    const status = computePipelineStatus(lastRunAt, errors);

    const stats: Record<string, number> = {};
    for (const [k, v] of Object.entries(rj)) {
      if (typeof v === 'number') stats[k] = v;
    }

    return { jobName, displayName, lastRunAt, status, stats };
  });

  // ── 2. Zero-payout firms (created > PAYOUT_ZERO_FIRM_MIN_AGE_DAYS days ago) ─
  const cutoffDate = new Date(Date.now() - PAYOUT_ZERO_FIRM_MIN_AGE_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: oldFirms } = await supabase
    .from('firm_profiles')
    .select('id, name')
    .lt('created_at', cutoffDate);

  const firmIds = (oldFirms ?? []).map((f: { id: string; name: string | null }) => f.id);

  let zeroPayoutFirms: string[] = [];
  if (firmIds.length > 0) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const { data: payoutRows } = await supabase
      .from('firm_recent_payouts')
      .select('firm_id')
      .in('firm_id', firmIds)
      .gte('timestamp', thirtyDaysAgo);

    const firmsWithPayouts = new Set((payoutRows ?? []).map((r: { firm_id: string }) => r.firm_id));
    const nameById = new Map(
      (oldFirms ?? []).map((f: { id: string; name: string | null }) => [f.id, f.name ?? f.id])
    );

    zeroPayoutFirms = firmIds
      .filter((id) => !firmsWithPayouts.has(id))
      .map((id) => nameById.get(id) ?? id);
  }

  // ── 3. Stale classifier backlog ──────────────────────────────────────────
  const { count: unclassifiedCount } = await supabase
    .from('firm_trustpilot_reviews')
    .select('*', { count: 'exact', head: true })
    .is('classified_at', null);

  const staleClassifierBacklog = unclassifiedCount ?? 0;

  // ── 4. New content (last 24h) ────────────────────────────────────────────
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: contentRows } = await supabase
    .from('firm_content_items')
    .select('content_type, firm_id')
    .gte('created_at', yesterday);

  const contentItems = contentRows ?? [];
  const byType: Record<string, number> = {};
  const firmIdSet = new Set<string>();

  for (const item of contentItems) {
    const t: string = item.content_type ?? 'other';
    byType[t] = (byType[t] ?? 0) + 1;
    if (item.firm_id) firmIdSet.add(item.firm_id as string);
  }

  let contentFirmNames: string[] = [];
  if (firmIdSet.size > 0) {
    const { data: firmProfiles } = await supabase
      .from('firm_profiles')
      .select('id, name')
      .in('id', [...firmIdSet]);

    const nameMap = new Map(
      (firmProfiles ?? []).map((f: { id: string; name: string | null }) => [f.id, f.name ?? f.id])
    );
    contentFirmNames = [...firmIdSet].map((id) => nameMap.get(id) ?? id);
  }

  return {
    pipelines,
    zeroPayoutFirms,
    staleClassifierBacklog,
    newContent: {
      total: contentItems.length,
      byType,
      firmNames: contentFirmNames,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Badge styles
// ---------------------------------------------------------------------------

const BADGE_STYLES: Record<PipelineStatus, string> = {
  critical:
    'background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;',
  warning:
    'background:#fffbeb;border:1px solid #fde68a;color:#d97706;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;',
  ok: 'background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;',
};

const BADGE_LABELS: Record<PipelineStatus, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  ok: 'OK',
};

// ---------------------------------------------------------------------------
// renderReportHtml
// ---------------------------------------------------------------------------

export function renderReportHtml(data: ReportData): string {
  const date = data.generatedAt.split('T')[0];

  // Section A — Pipeline Health
  const pipelineRows = data.pipelines
    .map((p) => {
      const badge = `<span style="${BADGE_STYLES[p.status]}">${BADGE_LABELS[p.status]}</span>`;
      const statsText = Object.entries(p.stats)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const lastRun = p.lastRunAt
        ? new Date(p.lastRunAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
        : 'Never';
      const statsSuffix = statsText ? ` &mdash; ${statsText}` : '';
      return `<tr>
  <td style="padding:6px 8px;">${badge}</td>
  <td style="padding:6px 8px;font-size:14px;">${p.displayName}</td>
  <td style="padding:6px 8px;font-size:12px;color:#64748b;">${lastRun}${statsSuffix}</td>
</tr>`;
    })
    .join('\n');

  // Section B — Data Alerts
  const alertItems: string[] = [];

  const criticalOrWarnPipelines = data.pipelines.filter((p) => p.status !== 'ok');
  for (const p of criticalOrWarnPipelines) {
    const label = p.status === 'critical' ? '🔴' : '🟡';
    alertItems.push(`<li>${label} <strong>${p.displayName}</strong> — pipeline is ${p.status}</li>`);
  }

  if (data.zeroPayoutFirms.length > 0) {
    const names = data.zeroPayoutFirms.join(', ');
    alertItems.push(
      `<li>🔴 <strong>Zero payouts (30d)</strong>: ${names}</li>`
    );
  }

  if (data.staleClassifierBacklog > CLASSIFIER_BACKLOG_THRESHOLD) {
    alertItems.push(
      `<li>🟡 <strong>Classifier backlog</strong>: ${data.staleClassifierBacklog} unclassified reviews (threshold: ${CLASSIFIER_BACKLOG_THRESHOLD})</li>`
    );
  }

  const sectionB =
    alertItems.length === 0
      ? '<p style="color:#16a34a;font-size:14px;margin:0;">&#x2705; All systems nominal</p>'
      : `<ul style="padding-left:20px;margin:8px 0;font-size:14px;">${alertItems.join('\n')}</ul>`;

  // Section C — New Content
  const byTypeLines = Object.entries(data.newContent.byType)
    .map(([t, c]) => `${t}: ${c}`)
    .join(', ');

  const firmList =
    data.newContent.firmNames.length > 0
      ? data.newContent.firmNames.join(', ')
      : '';

  const sectionC =
    data.newContent.total === 0
      ? '<p style="color:#64748b;font-size:14px;margin:0;">No new content ingested in the last 24h.</p>'
      : `<p style="font-size:14px;margin:4px 0;"><strong>Total:</strong> ${data.newContent.total}</p>
  <p style="font-size:14px;margin:4px 0;"><strong>By type:</strong> ${byTypeLines}</p>
  ${firmList ? `<p style="font-size:14px;margin:4px 0;"><strong>Firms:</strong> ${firmList}</p>` : ''}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1e293b;">
  <h1 style="font-size:20px;margin-bottom:4px;">Daily Admin Report</h1>
  <p style="color:#64748b;font-size:13px;margin-top:0;">${date} UTC</p>

  <h2 style="font-size:15px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-top:24px;">Pipeline Health</h2>
  <table style="border-collapse:collapse;width:100%;">
    ${pipelineRows}
  </table>

  <h2 style="font-size:15px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-top:24px;">Data Alerts</h2>
  ${sectionB}

  <h2 style="font-size:15px;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-top:24px;">Content Ingested (Last 24h)</h2>
  ${sectionC}

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
  <p style="font-size:12px;color:#94a3b8;">
    <a href="https://claude-wall.vercel.app/admin/dashboard" style="color:#6366f1;">View Admin Dashboard</a>
  </p>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Primary export
// ---------------------------------------------------------------------------

export async function buildDailyAdminReport(): Promise<{ subject: string; html: string }> {
  const data = await fetchReportData();
  const html = renderReportHtml(data);
  const date = new Date().toISOString().split('T')[0];
  return { subject: `Daily Admin Report \u2014 ${date}`, html };
}
