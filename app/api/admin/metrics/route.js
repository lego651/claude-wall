/**
 * PROP-021: Admin metrics endpoint.
 * GET /api/admin/metrics
 * Returns JSON with system health metrics. Requires authenticated user with is_admin.
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/libs/supabase/server';
import { usageTracker } from '@/lib/arbiscan';
import { getCacheStats } from '@/lib/cache';

const PAYOUTS_DIR = path.join(process.cwd(), 'data', 'payouts');
const LARGE_FILE_BYTES = 5 * 1024 * 1024; // 5MB alert threshold

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
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      counts[table] = error ? null : count;
    } catch {
      counts[table] = null;
    }
  }
  return counts;
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

  const [fileStats, dbStats] = await Promise.all([
    getFileStats(),
    getDbStats(supabase),
  ]);

  const arbiscan = usageTracker?.getUsage ? usageTracker.getUsage() : { calls: 0, limit: 0, percentage: 0, day: null };
  const cache = getCacheStats();

  const payload = {
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
