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

  const [fileStats, dbResult] = await Promise.all([
    getFileStats(),
    getDbStats(supabase),
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

  const checks = {
    config: {
      alertEmail: { set: !!(process.env.ALERT_EMAIL || process.env.ALERTS_TO), label: 'Alert email' },
      resend: { set: !!process.env.RESEND_API_KEY, label: 'Resend (emails)' },
      sentry: { set: !!process.env.SENTRY_DSN, label: 'Sentry' },
      cache: { set: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN), label: 'Vercel KV (cache)' },
    },
    fileSize: { status: fileSizeStatus, maxFileBytes, label: 'Payout file size' },
    arbiscan: { status: arbiscanStatus, percentage: arbiscanPct, label: 'Arbiscan usage' },
    supabase: { status: supabaseStatus, latencyMs: dbResult.latencyMs, label: 'Database' },
    cacheConfigured: { set: !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN), label: 'Cache configured' },
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

  const payload = {
    checks,
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
    apiLatency: { note: 'See Vercel Analytics for P50/P95/P99 by route' },
    errorRates: { note: 'See Vercel Analytics or logs for error rates by endpoint' },
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload);
}
