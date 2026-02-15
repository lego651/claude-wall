/**
 * TICKET-003: Incident detection (daily).
 * For each firm with Trustpilot, fetches classified reviews for the current ISO week,
 * groups by category, detects incidents (spike ≥3 or high_risk ≥1), generates title/summary
 * via OpenAI (batched), upserts to weekly_incidents.
 * Called by GitHub Actions (run-daily-incidents.yml).
 *
 * Usage:
 *   npx tsx scripts/run-daily-incidents.ts
 *
 * Env (from .env at project root):
 *   OPENAI_API_KEY                    - required
 *   NEXT_PUBLIC_SUPABASE_URL          - required
 *   SUPABASE_SERVICE_ROLE_KEY        - required
 *   INCIDENT_WEEK_OFFSET              - optional; 0 = current week, -1 = last week (default 0)
 */

import 'dotenv/config';
import { getFirmsWithTrustpilot } from '@/lib/scrapers/trustpilot';
import { getWeekBounds, getWeekNumber } from '@/lib/digest/week-utils';
import { detectIncidents } from '@/lib/digest/incident-aggregator';

const WEEK_OFFSET = parseInt(process.env.INCIDENT_WEEK_OFFSET || '0', 10);

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('[Incidents] OPENAI_API_KEY is not set. Add it to .env or environment.');
    process.exit(1);
  }

  const firms = await getFirmsWithTrustpilot();
  if (firms.length === 0) {
    console.log('[Incidents] No firms with Trustpilot URL found.');
    process.exit(0);
  }

  const now = new Date();
  const refDate = new Date(now.getTime() + WEEK_OFFSET * 7 * 24 * 60 * 60 * 1000);
  const { weekStart, weekEnd } = getWeekBounds(refDate);
  const weekNum = getWeekNumber(weekStart);
  const year = weekStart.getUTCFullYear();
  const weekLabel = `${year}-W${String(weekNum).padStart(2, '0')}`;

  console.log(`[Incidents] Processing week ${weekLabel} (${weekStart.toISOString().slice(0, 10)} – ${weekEnd.toISOString().slice(0, 10)}) for ${firms.length} firm(s).`);

  let totalIncidents = 0;
  for (let i = 0; i < firms.length; i++) {
    const firm = firms[i];
    try {
      const incidents = await detectIncidents(firm.id, weekStart, weekEnd);
      totalIncidents += incidents.length;
      console.log(`[Incidents] [Firm ${i + 1}/${firms.length}] ${firm.id}: ${incidents.length} incident(s) detected.`);
      for (const inc of incidents) {
        console.log(`[Incidents]   - ${inc.incident_type} (${inc.severity}): ${inc.title.slice(0, 60)}…`);
      }
    } catch (err) {
      console.error(`[Incidents] [Firm ${i + 1}/${firms.length}] ${firm.id} failed:`, err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  console.log(`[Incidents] Done. Total incidents: ${totalIncidents}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[Incidents] Fatal error:', err);
  process.exit(1);
});
