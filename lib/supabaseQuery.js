/**
 * PROP-016: Query timeout and slow-query logging for Supabase.
 * Use with any thenable (e.g. supabase.from('x').select()).
 */

import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'supabase' });

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_SLOW_THRESHOLD_MS = 1000;

/**
 * Run a Supabase query (or any Promise) with a timeout and optional slow-query log.
 * @param {Promise} promise - Query promise (e.g. supabase.from('t').select())
 * @param {Object} options
 * @param {number} [options.timeoutMs=5000] - Max wait before rejecting with "Query timeout"
 * @param {number} [options.slowThresholdMs=1000] - Log warning if query takes longer (ms)
 * @param {string} [options.context='query'] - Label for logs
 * @returns {Promise<*>} Same as the query promise; throws on timeout
 */
export async function withQueryGuard(promise, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    slowThresholdMs = DEFAULT_SLOW_THRESHOLD_MS,
    context = 'query',
  } = options;

  const start = Date.now();
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    if (duration >= slowThresholdMs) {
      log.warn({ duration, context, slowThresholdMs }, 'Slow query');
    }
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.message === 'Query timeout') {
      log.warn({ context, timeoutMs }, 'Query timeout');
    }
    throw err;
  }
}

/**
 * Race a promise against a timeout (no slow-query log).
 * @param {Promise} promise
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<*>}
 */
export function queryWithTimeout(promise, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return withQueryGuard(promise, { timeoutMs, slowThresholdMs: Number.POSITIVE_INFINITY });
}
