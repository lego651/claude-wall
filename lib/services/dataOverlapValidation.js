/**
 * PROP-018: Data overlap validation – compare JSON monthly data with Supabase recent_payouts.
 * Supabase only retains last 24h (recent_payouts), so overlap is meaningful for the current month.
 */

import { loadMonthlyData } from '@/lib/services/payoutDataLoader';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'dataOverlapValidation' });

/**
 * Get month bounds in ISO timestamp (start of first day, end of last day UTC).
 * @param {string} yearMonth - YYYY-MM
 * @returns {{ start: string, end: string }}
 */
function getMonthBounds(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

/**
 * Validate overlap between JSON monthly file and Supabase payouts for the same period.
 * @param {string} firmId - Firm identifier
 * @param {string} yearMonth - YYYY-MM
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Service-role client
 * @returns {Promise<{
 *   firmId: string,
 *   yearMonth: string,
 *   jsonCount: number,
 *   supabaseCount: number,
 *   missingInJson: Array<{ tx_hash: string, amount?: number }>,
 *   missingInSupabase: Array<{ tx_hash: string }>,
 *   matchRate: number | null
 * }>}
 */
export async function validateMonthData(firmId, yearMonth, supabase) {
  const { start, end } = getMonthBounds(yearMonth);

  const jsonData = await loadMonthlyData(firmId, yearMonth);
  const jsonTx = jsonData?.transactions ?? [];
  const jsonHashes = new Set(jsonTx.map((t) => t.tx_hash));

  const { data: supabaseRows, error } = await supabase
    .from('firm_recent_payouts')
    .select('tx_hash, amount')
    .eq('firm_id', firmId)
    .gte('timestamp', start)
    .lte('timestamp', end);

  if (error) {
    log.warn({ firmId, yearMonth, error: error.message }, 'Supabase query failed');
    return {
      firmId,
      yearMonth,
      jsonCount: jsonHashes.size,
      supabaseCount: 0,
      missingInJson: [],
      missingInSupabase: jsonTx.map((t) => ({ tx_hash: t.tx_hash })),
      matchRate: null,
      error: error.message,
    };
  }

  const supabaseList = supabaseRows ?? [];
  const supabaseHashes = new Set(supabaseList.map((r) => r.tx_hash));
  const missingInJson = supabaseList.filter((r) => !jsonHashes.has(r.tx_hash));
  const missingInSupabase = jsonTx.filter((t) => !supabaseHashes.has(t.tx_hash)).map((t) => ({ tx_hash: t.tx_hash }));

  const matchRate =
    supabaseList.length > 0
      ? (supabaseList.length - missingInJson.length) / supabaseList.length
      : null;

  return {
    firmId,
    yearMonth,
    jsonCount: jsonHashes.size,
    supabaseCount: supabaseList.length,
    missingInJson: missingInJson.map((r) => ({ tx_hash: r.tx_hash, amount: r.amount })),
    missingInSupabase,
    matchRate,
  };
}
