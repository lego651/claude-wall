/**
 * PROP-021: Admin metrics endpoint.
 * GET /api/admin/metrics
 * Returns JSON with system health metrics and verification checks.
 * Critical checks trigger an email to ALERT_EMAIL (throttled 1h per check).
 * Requires authenticated user with is_admin.
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { usageTracker } from '@/lib/arbiscan';
import { getCacheStats } from '@/lib/cache';
import { sendAlert, checkIntelligenceFeedAlerts } from '@/lib/alerts';
import { getWeekNumberUtc, getYearUtc, getWeekBoundsUtc } from '@/lib/digest/week-utils';

/** Incident detection: current week (UTC) and per-firm incident counts (for admin dashboard). */
async function getIncidentDetectionStatus(supabase, trustpilotFirms) {
  const now = new Date();
  const { weekStart } = getWeekBoundsUtc(now);
  const weekNumber = getWeekNumberUtc(weekStart);
  const year = getYearUtc(weekStart);
  const weekLabel = `${year}-W${String(weekNumber).padStart(2, '0')}`;

  let rows = [];
  let lastRunAt = null;
  try {
    const [{ data, error }, { data: latestRow }] = await Promise.all([
      supabase
        .from('firm_daily_incidents')
        .select('firm_id')
        .eq('week_number', weekNumber)
        .eq('year', year),
      supabase
        .from('firm_daily_incidents')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (error) return { currentWeek: { weekNumber, year, weekLabel }, firms: [], lastRunAt: null, error: error.message };
    rows = data || [];
    lastRunAt = latestRow?.created_at ? new Date(latestRow.created_at).toISOString() : null;
  } catch (e) {
    return { currentWeek: { weekNumber, year, weekLabel }, firms: [], lastRunAt: null, error: e.message };
  }

  const countByFirm = new Map();
  for (const r of rows) {
    const id = r.firm_id;
    if (id != null) countByFirm.set(id, (countByFirm.get(id) || 0) + 1);
  }

  const firms = (trustpilotFirms || []).map((f) => ({
    firmId: f.id,
    firmName: f.name || f.id,
    incidentCount: countByFirm.get(f.id) ?? 0,
  }));

  return { currentWeek: { weekNumber, year, weekLabel }, firms, lastRunAt };
}

/** Unclassified review count for classifier backlog alert (TICKET-014). */
async function getClassifyUnclassifiedCount(supabase) {
  try {
    const [
      { count: total },
      { count: classified },
    ] = await Promise.all([
      supabase.from('firm_trustpilot_reviews').select('*', { count: 'exact', head: true }),
      supabase.from('firm_trustpilot_reviews').select('*', { count: 'exact', head: true }).not('classified_at', 'is', null),
    ]);
    const unclassified = total != null && classified != null ? total - classified : 0;
    return { unclassified: Math.max(0, unclassified) };
  } catch {
    return { unclassified: null };
  }
}

const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'propfirms');
const LARGE_FILE_BYTES = 5 * 1024 * 1024; // 5MB warning
const FAIL_FILE_BYTES = 10 * 1024 * 1024; // 10MB critical
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per check key

const lastAlertSent = {};

function shouldSendAlert(checkKey) {
  const now = Date.now();
  if (lastAlertSent[checkKey] && now - lastAlertSent[checkKey] < ALERT_COOLDOWN_MS) return false;
  lastAlertSent[checkKey] = now;
  return true;
}

async function getFileStats() {
  const result = { totalBytes: 0, totalFiles: 0, largest: [], error: null };
  try {
    const exists = await fs.promises.access(PAYOUTS_DIR).then(() => true).catch(() => false);
    if (!exists) return result;

    const firmDirs = await fs.promises.readdir(PAYOUTS_DIR);
    const files = [];

    for (const firmId of firmDirs) {
      const firmPath = path.join(PAYOUTS_DIR, firmId);
      const stat = await fs.promises.stat(firmPath).catch(() => null);
      if (!stat?.isDirectory()) continue;

      const entries = await fs.promises.readdir(firmPath, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
        const filePath = path.join(firmPath, ent.name);
        const fileStat = await fs.promises.stat(filePath).catch(() => null);
        if (!fileStat) continue;
        result.totalBytes += fileStat.size;
        result.totalFiles += 1;
        files.push({ path: path.relative(process.cwd(), filePath), bytes: fileStat.size });
      }
    }

    files.sort((a, b) => b.bytes - a.bytes);
    result.largest = files.slice(0, 10);
    return result;
  } catch (err) {
    result.error = err.message;
    return result;
  }
}

async function getDbStats(supabase) {
  const tables = ['firm_profiles', 'firm_recent_payouts', 'firm_trustpilot_reviews', 'firm_daily_incidents', 'firm_weekly_reports', 'user_subscriptions'];
  const counts = {};
  const start = Date.now();
  let ok = true;
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      counts[table] = error ? null : count;
      if (error) ok = false;
    } catch {
      counts[table] = null;
      ok = false;
    }
  }
  const latencyMs = Date.now() - start;
  return { counts, latencyMs, ok };
}

/** Count payouts per firm for a time window; returns Map<firmId, count>. */
function countByFirm(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = row.firm_id;
    if (id != null) map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}

/** Intelligence feed: current week (UTC) report coverage, subscription counts. */
async function getIntelligenceFeedStatus(supabase) {
  const now = new Date();
  const { weekStart, weekEnd } = getWeekBoundsUtc(now);
  const weekNumber = getWeekNumberUtc(weekStart);
  const year = getYearUtc(weekStart);
  const weekLabel = `W${String(weekNumber).padStart(2, '0')} ${year}`;
  const weekFromIso = weekStart.toISOString().slice(0, 10);
  const weekToIso = weekEnd.toISOString().slice(0, 10);

  let firmsWithReport = [];
  let firmsExpected = [];
  let subscriptionsTotal = 0;
  let subscriptionsEmailEnabled = 0;

  try {
    const { data: reportRows } = await supabase
      .from('firm_weekly_reports')
      .select('firm_id')
      .eq('week_from_date', weekFromIso)
      .eq('week_to_date', weekToIso);
    firmsWithReport = (reportRows || []).map((r) => r.firm_id);

    const { data: firmRows } = await supabase
      .from('firm_profiles')
      .select('id, name')
      .not('trustpilot_url', 'is', null)
      .order('id');
    firmsExpected = firmRows || [];

    const { count: total } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true });
    const { count: enabled } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('email_enabled', true);
    subscriptionsTotal = total ?? 0;
    subscriptionsEmailEnabled = enabled ?? 0;
  } catch {
    // leave defaults
  }

  const firmIdsWithReport = new Set(firmsWithReport);
  const firmsWithReportList = firmsExpected.filter((f) => firmIdsWithReport.has(f.id));
  const firmsWithoutReportList = firmsExpected.filter((f) => !firmIdsWithReport.has(f.id));

  return {
    lastWeek: {
      weekNumber,
      year,
      weekLabel,
      firmsWithReport: firmsWithReportList.length,
      firmsExpected: firmsExpected.length,
      firmIdsWithReport: firmsWithReportList.map((f) => ({ id: f.id, name: f.name })),
      firmIdsWithoutReport: firmsWithoutReportList.map((f) => ({ id: f.id, name: f.name })),
    },
    subscriptionsTotal,
    subscriptionsEmailEnabled,
    weekLabel,
  };
}

/** Last run of generate-weekly-reports script (from cron_last_run). */
async function getGenerateWeeklyReportsLastRun(supabase) {
  try {
    const { data, error } = await supabase
      .from('cron_last_run')
      .select('last_run_at, result_json')
      .eq('job_name', 'generate_weekly_reports')
      .maybeSingle();
    if (error || !data) return null;
    const r = data.result_json || {};
    return {
      lastRunAt: data.last_run_at,
      firmsProcessed: r.firmsProcessed ?? null,
      successCount: r.successCount ?? null,
      errorCount: r.errorCount ?? null,
      errors: Array.isArray(r.errors) ? r.errors : [],
      weekLabel: r.weekLabel ?? null,
      weekStart: r.weekStartIso ?? r.weekStart ?? null,
      weekEnd: r.weekEndIso ?? r.weekEnd ?? null,
      durationMs: r.durationMs ?? null,
    };
  } catch {
    return null;
  }
}

/** Last run of send-weekly-reports cron (from cron_last_run). */
async function getWeeklyEmailLastRun(supabase) {
  try {
    const { data, error } = await supabase
      .from('cron_last_run')
      .select('last_run_at, result_json')
      .eq('job_name', 'send_weekly_reports')
      .maybeSingle();
    if (error || !data) return { lastRunAt: null, sent: null, failed: null, skipped: null, weekStart: null, weekEnd: null, errors: [] };
    const r = data.result_json || {};
    return {
      lastRunAt: data.last_run_at,
      sent: r.sent,
      failed: r.failed,
      skipped: r.skipped,
      weekStart: r.weekStart,
      weekEnd: r.weekEnd,
      errors: Array.isArray(r.errors) ? r.errors : [],
    };
  } catch {
    return { lastRunAt: null, sent: null, failed: null, skipped: null, weekStart: null, weekEnd: null, errors: [] };
  }
}

/** Firms with Trustpilot URL and their last scraper run status (for admin dashboard). */
async function getTrustpilotScraperStatus(supabase) {
  try {
    const { data, error } = await supabase
      .from('firm_profiles')
      .select('id, name, last_scraper_run_at, last_scraper_reviews_scraped, last_scraper_reviews_stored, last_scraper_duplicates_skipped, last_scraper_error')
      .not('trustpilot_url', 'is', null)
      .order('id');
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

/** Per-firm payout counts (24h, 7d, 30d) and erratic detection. Returns only firms with warning or critical. */
async function getPropfirmsPayoutCounts(supabase) {
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * 24 * ms24h;
  const ms30d = 30 * 24 * ms24h;
  const cutoffs = {
    '24h': new Date(now - ms24h).toISOString(),
    '7d': new Date(now - ms7d).toISOString(),
    '30d': new Date(now - ms30d).toISOString(),
  };

  let firms = [];
  try {
    const { data: firmsRows } = await supabase.from('firm_profiles').select('id, name');
    firms = firmsRows || [];
  } catch {
    // ignore
  }

  const count24hByFirm = new Map();
  const count7dByFirm = new Map();
  const count30dByFirm = new Map();
  for (const [label, cutoff] of Object.entries(cutoffs)) {
    try {
      const { data: rows } = await supabase
        .from('firm_recent_payouts')
        .select('firm_id')
        .gte('timestamp', cutoff);
      const map = countByFirm(rows);
      if (label === '24h') map.forEach((c, id) => count24hByFirm.set(id, c));
      else if (label === '7d') map.forEach((c, id) => count7dByFirm.set(id, c));
      else map.forEach((c, id) => count30dByFirm.set(id, c));
    } catch {
      // ignore
    }
  }

  const firmsWithIssues = [];
  for (const firm of firms) {
    const firmId = firm.id;
    const c24 = count24hByFirm.get(firmId) ?? 0;
    const c7 = count7dByFirm.get(firmId) ?? 0;
    const c30 = count30dByFirm.get(firmId) ?? 0;
    const expected24h = c7 >= 7 ? c7 / 7 : null;
    const expected7d = c30 >= 10 ? (c30 * 7) / 30 : null;

    const flags = [];
    if (expected24h != null && expected24h >= 1) {
      if (c24 === 0) flags.push({ period: '24h', type: 'zero', message: '0 in 24h (7d had data)' });
      else if (c24 < 0.2 * expected24h) flags.push({ period: '24h', type: 'low', message: `24h ${c24} much lower than usual (~${Math.round(expected24h)}/day)` });
      else if (c24 > 3 * expected24h) flags.push({ period: '24h', type: 'high', message: `24h ${c24} much higher than usual (~${Math.round(expected24h)}/day)` });
    }
    if (expected7d != null && expected7d >= 1) {
      if (c7 < 0.2 * expected7d) flags.push({ period: '7d', type: 'low', message: `7d ${c7} much lower than usual (~${Math.round(expected7d)} for 7d)` });
      else if (c7 > 3 * expected7d) flags.push({ period: '7d', type: 'high', message: `7d ${c7} much higher than usual (~${Math.round(expected7d)} for 7d)` });
    }

    if (flags.length === 0) continue;
    const status = flags.some((f) => f.type === 'zero') ? 'critical' : 'warning';
    const statusByPeriod = { '24h': 'ok', '7d': 'ok', '30d': 'ok' };
    const messagesByPeriod = { '24h': [], '7d': [], '30d': [] };
    for (const f of flags) {
      const p = f.period;
      if (p && statusByPeriod[p] !== undefined) {
        messagesByPeriod[p].push(f.message);
        statusByPeriod[p] = f.type === 'zero' ? 'critical' : 'warning';
      }
    }
    firmsWithIssues.push({
      firmId,
      firmName: firm.name || firmId,
      counts: { '24h': c24, '7d': c7, '30d': c30 },
      status,
      flags,
      statusByPeriod,
      messagesByPeriod,
    });
  }

  const overallStatus = firmsWithIssues.some((f) => f.status === 'critical') ? 'critical' : firmsWithIssues.length > 0 ? 'warning' : 'ok';
  return { firmsWithIssues, overallStatus };
}

/**
 * Daily firm payout sync status: last 7 days per firm (file mtime in data/propfirms).
 * One day missing = warning, two consecutive days missing = critical.
 */
async function getFirmPayoutSyncDaily(supabase) {
  const DAYS = 7;
  const now = new Date();
  const days = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const dateStr = d.toISOString().slice(0, 10);
    let label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : null;
    if (label == null) label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    days.push({ date: dateStr, label });
  }

  let firms = [];
  try {
    const { data: firmsRows } = await supabase.from('firm_profiles').select('id, name');
    firms = firmsRows || [];
  } catch {
    return { days, firms: [], error: 'Failed to load firms' };
  }

  const exists = await fs.promises.access(PAYOUTS_DIR).then(() => true).catch(() => false);
  if (!exists) {
    return {
      days,
      firms: firms.map((f) => ({ firmId: f.id, firmName: f.name || f.id, byDate: {}, status: 'warning', message: 'No payout data dir' })),
      error: null,
    };
  }

  const firmDirs = await fs.promises.readdir(PAYOUTS_DIR).catch(() => []);
  const dateSetByFirm = new Map();

  for (const firm of firms) {
    const firmPath = path.join(PAYOUTS_DIR, firm.id);
    const stat = await fs.promises.stat(firmPath).catch(() => null);
    if (!stat?.isDirectory()) {
      dateSetByFirm.set(firm.id, new Set());
      continue;
    }
    const entries = await fs.promises.readdir(firmPath, { withFileTypes: true }).catch(() => []);
    const dates = new Set();
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
      const filePath = path.join(firmPath, ent.name);
      const fileStat = await fs.promises.stat(filePath).catch(() => null);
      if (!fileStat?.mtime) continue;
      const m = new Date(fileStat.mtime);
      dates.add(m.toISOString().slice(0, 10));
    }
    dateSetByFirm.set(firm.id, dates);
  }

  const dayDates = days.map((d) => d.date);
  const result = firms.map((firm) => {
    const datesSet = dateSetByFirm.get(firm.id) || new Set();
    const byDate = {};
    for (let i = 0; i < dayDates.length; i++) {
      const date = dayDates[i];
      byDate[date] = { updated: datesSet.has(date) };
    }
    const totalEmptyFromToday = (() => {
      let c = 0;
      for (let i = 0; i < dayDates.length; i++) {
        if (!byDate[dayDates[i]].updated) c++; else break;
      }
      return c;
    })();
    let status = 'ok';
    let message = null;
    if (totalEmptyFromToday >= 2) {
      status = 'critical';
      message = `${totalEmptyFromToday} consecutive days missing`;
    } else if (totalEmptyFromToday === 1) {
      status = 'warning';
      message = '1 day missing';
    }
    return {
      firmId: firm.id,
      firmName: firm.name || firm.id,
      byDate,
      status,
      message,
    };
  });

  return { days, firms: result, error: null };
}

/** Trader monitoring: sign-up, wallet link, backfill, realtime sync status and errors. */
async function getTraderMonitoringStatus() {
  try {
    const service = createServiceClient();
    const [
      { data: profiles, error: profilesError },
      { data: records, error: recordsError },
    ] = await Promise.all([
      service
        .from('user_profiles')
        .select('id, email, display_name, handle, wallet_address, backfilled_at, created_at, updated_at')
        .order('created_at', { ascending: false }),
      service
        .from('trader_records')
        .select('wallet_address, profile_id, last_synced_at, sync_error, total_payout_usd, payout_count'),
    ]);
    if (profilesError) return { error: profilesError.message, summary: null, traders: [] };
    if (recordsError) return { error: recordsError.message, summary: null, traders: [] };

    const profilesList = profiles || [];
    const recordsList = records || [];
    const recordByWallet = new Map(recordsList.map((r) => [r.wallet_address?.toLowerCase(), r]));
    const recordByProfile = new Map(recordsList.map((r) => [r.profile_id, r]).filter(([, r]) => r.profile_id != null));

    const withWallet = profilesList.filter((p) => p.wallet_address?.trim());
    const backfilled = withWallet.filter((p) => p.backfilled_at != null);
    const pendingBackfill = withWallet.filter((p) => p.backfilled_at == null);
    const syncErrors = recordsList.filter((r) => r.sync_error?.trim());

    const traders = profilesList.map((p) => {
      const walletLower = p.wallet_address?.trim()?.toLowerCase();
      const rec = walletLower
        ? recordByWallet.get(walletLower) ?? recordByProfile.get(p.id) ?? null
        : null;
      return {
        id: p.id,
        email: p.email ?? '—',
        display_name: p.display_name ?? '—',
        handle: p.handle ?? '—',
        wallet_address: p.wallet_address ?? null,
        created_at: p.created_at,
        updated_at: p.updated_at,
        backfilled_at: p.backfilled_at ?? null,
        last_synced_at: rec?.last_synced_at ?? null,
        sync_error: rec?.sync_error ?? null,
        total_payout_usd: rec?.total_payout_usd ?? null,
        payout_count: rec?.payout_count ?? null,
      };
    });

    return {
      error: null,
      summary: {
        totalProfiles: profilesList.length,
        withWallet: withWallet.length,
        backfilled: backfilled.length,
        pendingBackfill: pendingBackfill.length,
        syncErrors: syncErrors.length,
      },
      traders,
    };
  } catch (e) {
    return { error: e.message, summary: null, traders: [] };
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [fileStats, dbResult, propfirmsData, trustpilotScraperFirms, intelligenceFeed, generateWeeklyReportsRun, weeklyEmailLastRun, traderMonitoring, firmPayoutSyncDaily] = await Promise.all([
    getFileStats(),
    getDbStats(supabase),
    getPropfirmsPayoutCounts(supabase),
    getTrustpilotScraperStatus(supabase),
    getIntelligenceFeedStatus(supabase),
    getGenerateWeeklyReportsLastRun(supabase),
    getWeeklyEmailLastRun(supabase),
    getTraderMonitoringStatus(),
    getFirmPayoutSyncDaily(supabase),
  ]);

  const incidentDetection = await getIncidentDetectionStatus(supabase, trustpilotScraperFirms);
  const classifyReviews = await getClassifyUnclassifiedCount(supabase);

  const arbiscan = usageTracker?.getUsage ? usageTracker.getUsage() : { calls: 0, limit: 0, percentage: 0, day: null };
  const cache = getCacheStats();
  const dbStats = dbResult.counts;

  // Max payout file size (bytes)
  const maxFileBytes = fileStats.largest.length ? Math.max(...fileStats.largest.map((f) => f.bytes)) : 0;
  const fileSizeStatus = maxFileBytes >= FAIL_FILE_BYTES ? 'critical' : maxFileBytes >= LARGE_FILE_BYTES ? 'warning' : 'ok';
  const arbiscanPct = arbiscan.percentage ?? 0;
  const arbiscanStatus = arbiscanPct >= 95 ? 'critical' : arbiscanPct >= 80 ? 'warning' : 'ok';
  const supabaseStatus = dbResult.ok ? 'ok' : 'critical';

  const alertTo = process.env.ALERT_EMAIL || process.env.ALERTS_TO || '';
  const resendSet = !!process.env.RESEND_API_KEY;
  const alertsEnabled = !!alertTo.trim() && resendSet;
  const maskedRecipient = alertTo.trim()
    ? (() => {
        const e = alertTo.trim();
        const at = e.indexOf('@');
        if (at <= 0) return e.slice(0, 2) + '***';
        return e.slice(0, 1) + '***@' + e.slice(at + 1);
      })()
    : null;

  const checks = {
    config: {
      alertEmail: { set: !!alertTo.trim(), label: 'Alert email' },
      resend: { set: resendSet, label: 'Resend (emails)' },
      sentry: { set: !!process.env.SENTRY_DSN, label: 'Sentry' },
      cache: { set: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN), label: 'Vercel KV (cache)' },
    },
    fileSize: { status: fileSizeStatus, maxFileBytes, label: 'Payout file size' },
    arbiscan: { status: arbiscanStatus, percentage: arbiscanPct, label: 'Arbiscan usage' },
    supabase: { status: supabaseStatus, latencyMs: dbResult.latencyMs, label: 'Database' },
    cacheConfigured: { set: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN), label: 'Cache configured' },
    propfirmsData: {
      status: propfirmsData.overallStatus,
      label: 'Prop firms payout data',
      firmsWithIssues: propfirmsData.firmsWithIssues,
    },
  };

  // Send email for critical checks (throttled)
  if (fileSizeStatus === 'critical' && shouldSendAlert('file_size_critical')) {
    sendAlert(
      'Admin dashboard',
      `A payout file is ≥10 MB (max: ${(maxFileBytes / (1024 * 1024)).toFixed(2)} MB). Risk of timeouts.`,
      'CRITICAL',
      { maxFileBytes, largest: fileStats.largest.slice(0, 3).map((f) => ({ path: f.path, bytes: f.bytes })) }
    ).catch(() => {});
  }
  if (arbiscanStatus === 'critical' && shouldSendAlert('arbiscan_critical')) {
    sendAlert(
      'Admin dashboard',
      `Arbiscan usage at ${arbiscanPct}% of daily limit. Approaching rate limit.`,
      'CRITICAL',
      { calls: arbiscan.calls, limit: arbiscan.limit, percentage: arbiscanPct }
    ).catch(() => {});
  }
  if (supabaseStatus === 'critical' && shouldSendAlert('supabase_critical')) {
    sendAlert(
      'Admin dashboard',
      'Supabase check failed (count queries failed or timed out).',
      'CRITICAL',
      { latencyMs: dbResult.latencyMs }
    ).catch(() => {});
  }
  const criticalFirms = propfirmsData.firmsWithIssues.filter((f) => f.status === 'critical');
  if (criticalFirms.length > 0 && shouldSendAlert('propfirms_data_critical')) {
    const names = criticalFirms.map((f) => f.firmName || f.firmId).join(', ');
    sendAlert('Admin dashboard', `Prop firms payout data: ${criticalFirms.length} firm(s) critical (${names}).`, 'CRITICAL', {
      firms: criticalFirms.map((f) => ({ firmId: f.firmId, firmName: f.firmName, counts: f.counts, flags: f.flags })),
    }).catch(() => {});
  }

  const payload = {
    checks,
    alerts: {
      status: alertsEnabled ? 'enabled' : 'disabled',
      recipient: maskedRecipient,
      resendConfigured: resendSet,
    },
    arbiscan: {
      calls: arbiscan.calls ?? 0,
      limit: arbiscan.limit ?? 0,
      percentage: arbiscan.percentage ?? 0,
      day: arbiscan.day ?? null,
    },
    files: {
      totalBytes: fileStats.totalBytes,
      totalFiles: fileStats.totalFiles,
      totalMB: Math.round((fileStats.totalBytes / (1024 * 1024)) * 100) / 100,
      largest: fileStats.largest.map(({ path: p, bytes }) => ({ path: p, bytes, over5MB: bytes > LARGE_FILE_BYTES })),
      error: fileStats.error,
    },
    database: dbStats,
    cache: {
      hits: cache.hits,
      misses: cache.misses,
      hitRate: cache.hitRate,
    },
    propfirmsData: {
      firmsWithIssues: propfirmsData.firmsWithIssues,
      overallStatus: propfirmsData.overallStatus,
    },
    firmPayoutSyncDaily: firmPayoutSyncDaily ?? { days: [], firms: [], error: null },
    trustpilotScraper: {
      firms: trustpilotScraperFirms,
      note: 'Updated by daily GitHub Actions (daily-step1-sync-firm-trustpilot-reviews). Refresh to see latest run.',
    },
    intelligenceFeed: {
      lastWeek: intelligenceFeed.lastWeek,
      subscriptionsTotal: intelligenceFeed.subscriptionsTotal,
      subscriptionsEmailEnabled: intelligenceFeed.subscriptionsEmailEnabled,
      weekLabel: intelligenceFeed.weekLabel,
    },
    generateWeeklyReportsRun: generateWeeklyReportsRun
      ? {
          lastRunAt: generateWeeklyReportsRun.lastRunAt,
          firmsProcessed: generateWeeklyReportsRun.firmsProcessed,
          successCount: generateWeeklyReportsRun.successCount,
          errorCount: generateWeeklyReportsRun.errorCount,
          errors: generateWeeklyReportsRun.errors,
          weekLabel: generateWeeklyReportsRun.weekLabel,
          weekStart: generateWeeklyReportsRun.weekStart,
          weekEnd: generateWeeklyReportsRun.weekEnd,
          durationMs: generateWeeklyReportsRun.durationMs,
          note: 'Runs Sunday 7:00 UTC via weekly-step1-generate-firm-weekly-reports. Populates firm_weekly_reports for current week (Mon–Sun UTC) before Weekly 2 send.',
        }
      : null,
    weeklyEmailReport: {
      lastRunAt: weeklyEmailLastRun.lastRunAt,
      sent: weeklyEmailLastRun.sent,
      failed: weeklyEmailLastRun.failed,
      skipped: weeklyEmailLastRun.skipped,
      weekStart: weeklyEmailLastRun.weekStart,
      weekEnd: weeklyEmailLastRun.weekEnd,
      errors: weeklyEmailLastRun.errors,
      note: 'Weekly 2: Send runs Sunday 8:00 UTC via weekly-step2-send-firm-weekly-reports workflow.',
    },
    incidentDetection: {
      currentWeek: incidentDetection.currentWeek,
      firms: incidentDetection.firms,
      lastRunAt: incidentDetection.lastRunAt ?? null,
      note: 'Run daily at 5 AM PST (13:00 UTC), 1 hour after classifier. Pipeline: scrape → classify → incidents.',
    },
    classifyReviews: {
      unclassified: classifyReviews.unclassified,
    },
    traders: traderMonitoring?.error
      ? { error: traderMonitoring.error, summary: null, traders: [] }
      : {
          summary: traderMonitoring?.summary ?? null,
          traders: traderMonitoring?.traders ?? [],
        },
    apiLatency: { note: 'See Vercel Analytics for P50/P95/P99 by route' },
    errorRates: { note: 'See Vercel Analytics or logs for error rates by endpoint' },
    fetchedAt: new Date().toISOString(),
  };

  const alertPromise = checkIntelligenceFeedAlerts(payload);
  if (alertPromise && typeof alertPromise.catch === 'function') {
    alertPromise.catch(() => {});
  }

  return NextResponse.json(payload);
}
