/**
 * Generate firm_weekly_reports for the current week (Mon–Sun UTC).
 * Run by GitHub Actions (step3b-generate-weekly-reports-weekly.yml) every Sunday 7:00 UTC.
 * Digest (Weekly 2) runs Sunday 8:00 UTC and uses this data.
 * Persists last run and summary to cron_last_run for admin dashboard monitoring.
 *
 * Usage:
 *   npx tsx scripts/generate-firm-weekly-reports.ts
 *
 * Optional env:
 *   REPORT_FIRM_IDS  - comma-separated firm ids (default: all firms with Trustpilot)
 *
 * Env (from .env): OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createServiceClient } from '@/lib/supabase/service';
import { getFirmsWithTrustpilot } from '@/lib/scrapers/trustpilot';
import { getCurrentWeekUtc, getWeekNumberUtc, getYearUtc } from '@/lib/digest/week-utils';
import { generateWeeklyReport } from '@/lib/digest/generator';

const CRON_JOB_NAME = 'generate_weekly_reports';

async function persistCronLastRun(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  result: {
    firmsProcessed: number;
    successCount: number;
    errorCount: number;
    errors: string[];
    weekLabel: string;
    weekStartIso: string;
    weekEndIso: string;
    durationMs: number;
  }
): Promise<void> {
  try {
    await supabase.from('cron_last_run').upsert(
      {
        job_name: CRON_JOB_NAME,
        last_run_at: new Date().toISOString(),
        result_json: result,
      },
      { onConflict: 'job_name' }
    );
  } catch (e) {
    console.error('[generate-weekly-reports] persistCronLastRun', e);
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();
  if (!process.env.OPENAI_API_KEY) {
    console.error('[generate-weekly-reports] OPENAI_API_KEY is not set.');
    process.exit(1);
  }

  const { weekStart, weekEnd } = getCurrentWeekUtc();
  const weekNum = getWeekNumberUtc(weekStart);
  const year = getYearUtc(weekStart);
  const weekLabel = `${year}-W${String(weekNum).padStart(2, '0')}`;
  const weekStartIso = weekStart.toISOString().slice(0, 10);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);

  let firms = await getFirmsWithTrustpilot();
  const filterIds = process.env.REPORT_FIRM_IDS?.split(',').map((s) => s.trim()).filter(Boolean);
  if (filterIds?.length) {
    firms = firms.filter((f) => filterIds.includes(f.id));
  }

  if (firms.length === 0) {
    console.log('[generate-weekly-reports] No firms to process (filter or Trustpilot list empty).');
    const supabase = createServiceClient();
    await persistCronLastRun(supabase, {
      firmsProcessed: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      weekLabel,
      weekStartIso,
      weekEndIso,
      durationMs: Date.now() - startTime,
    });
    process.exit(0);
  }

  console.log(
    `[generate-weekly-reports] Week ${weekLabel} (${weekStartIso} – ${weekEndIso}), ${firms.length} firm(s).`
  );

  let successCount = 0;
  const errors: string[] = [];
  const supabase = createServiceClient();

  for (let i = 0; i < firms.length; i++) {
    const firm = firms[i];
    try {
      await generateWeeklyReport(firm.id, weekStart, weekEnd);
      successCount += 1;
      console.log(`[generate-weekly-reports] [${i + 1}/${firms.length}] ${firm.id} ok.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${firm.id}: ${msg}`);
      console.error(`[generate-weekly-reports] [${i + 1}/${firms.length}] ${firm.id} failed:`, msg);
    }
  }

  const durationMs = Date.now() - startTime;
  await persistCronLastRun(supabase, {
    firmsProcessed: firms.length,
    successCount,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
    weekLabel,
    weekStartIso,
    weekEndIso,
    durationMs,
  });

  console.log(
    `[generate-weekly-reports] Done. ${successCount}/${firms.length} firms; ${errors.length} error(s). You can now trigger send-weekly-reports.`
  );
  process.exit(errors.length === firms.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[generate-weekly-reports] Fatal error:', err);
  process.exit(1);
});
