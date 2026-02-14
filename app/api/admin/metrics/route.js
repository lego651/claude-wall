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
import { createClient } from '@/libs/supabase/server';
import { usageTracker } from '@/lib/arbiscan';
import { getCacheStats } from '@/lib/cache';
import { sendAlert } from '@/lib/alerts';

const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'payouts');
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
  const tables = ['firms', 'recent_payouts', 'trustpilot_reviews', 'weekly_incidents'];
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

/** Payout counts for 24h, 7d, 30d and erratic detection (vs usual). */
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

  const counts = { '24h': null, '7d': null, '30d': null };
  for (const [label, cutoff] of Object.entries(cutoffs)) {
    try {
      const { count, error } = await supabase
        .from('recent_payouts')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', cutoff);
      counts[label] = error ? null : count;
    } catch {
      counts[label] = null;
    }
  }

  const c24 = counts['24h'] ?? 0;
  const c7 = counts['7d'] ?? 0;
  const c30 = counts['30d'] ?? 0;
  const expected24h = c7 >= 7 ? c7 / 7 : null;
  const expected7d = c30 >= 10 ? (c30 * 7) / 30 : null;

  const flags = [];
  if (expected24h != null && expected24h >= 1) {
    if (c24 === 0) flags.push({ period: '24h', type: 'zero', message: 'Payout count is 0 (7d had data)' });
    else if (c24 < 0.2 * expected24h) flags.push({ period: '24h', type: 'low', message: `24h count ${c24} is much lower than usual (~${Math.round(expected24h)}/day)` });
    else if (c24 > 3 * expected24h) flags.push({ period: '24h', type: 'high', message: `24h count ${c24} is much higher than usual (~${Math.round(expected24h)}/day)` });
  }
  if (expected7d != null && expected7d >= 1) {
    if (c7 < 0.2 * expected7d) flags.push({ period: '7d', type: 'low', message: `7d count ${c7} is much lower than usual (~${Math.round(expected7d)} for 7d)` });
    else if (c7 > 3 * expected7d) flags.push({ period: '7d', type: 'high', message: `7d count ${c7} is much higher than usual (~${Math.round(expected7d)} for 7d)` });
  }

  const status = flags.some((f) => f.type === 'zero') ? 'critical' : flags.length > 0 ? 'warning' : 'ok';
  return { counts: { '24h': c24, '7d': c7, '30d': c30 }, erratic: { status, flags } };
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
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [fileStats, dbResult, propfirmsData] = await Promise.all([
    getFileStats(),
    getDbStats(supabase),
    getPropfirmsPayoutCounts(supabase),
  ]);

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
      status: propfirmsData.erratic.status,
      label: 'Prop firms payout data',
      counts: propfirmsData.counts,
      flags: propfirmsData.erratic.flags,
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
  if (propfirmsData.erratic.status === 'critical' && shouldSendAlert('propfirms_data_critical')) {
    const msg = propfirmsData.erratic.flags.find((f) => f.type === 'zero')
      ? 'Prop firms payout count dropped to 0 in last 24h (7d had data).'
      : 'Prop firms data erratic: ' + propfirmsData.erratic.flags.map((f) => f.message).join('; ');
    sendAlert('Admin dashboard', msg, 'CRITICAL', {
      counts: propfirmsData.counts,
      flags: propfirmsData.erratic.flags,
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
      counts: propfirmsData.counts,
      erratic: propfirmsData.erratic,
    },
    apiLatency: { note: 'See Vercel Analytics for P50/P95/P99 by route' },
    errorRates: { note: 'See Vercel Analytics or logs for error rates by endpoint' },
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload);
}
