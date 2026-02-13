/**
 * PROP-020: Analytics helpers for Vercel Web Analytics.
 * Use from API routes (server) to track custom events.
 * Client components can import { track } from '@vercel/analytics' directly.
 */

/**
 * Track API response time (server-side). Call at the end of an API route.
 * Requires Vercel Analytics enabled and Pro/Enterprise for custom events.
 * @param {string} route - Route path (e.g. '/api/v2/propfirms')
 * @param {number} durationMs - Response time in milliseconds
 * @param {number} [status=200] - HTTP status code
 */
export async function trackApiResponse(route, durationMs, status = 200) {
  try {
    const { track } = await import('@vercel/analytics/server');
    await track('api_response', { route, durationMs, status });
  } catch {
    // No-op if analytics unavailable (e.g. dev, test, or plan doesn't support custom events)
  }
}

/**
 * Track Arbiscan API call (server-side). Call after each Arbiscan request if desired.
 * @param {string} action - e.g. 'native' | 'token'
 * @param {number} durationMs
 * @param {boolean} [success=true]
 */
export async function trackArbiscanCall(action, durationMs, success = true) {
  try {
    const { track } = await import('@vercel/analytics/server');
    await track('arbiscan_call', { action, durationMs, success });
  } catch {
    // No-op
  }
}

/**
 * Track cache hit/miss (server-side).
 * @param {string} key - Cache key or pattern
 * @param {'hit'|'miss'} result
 */
export async function trackCacheResult(key, result) {
  try {
    const { track } = await import('@vercel/analytics/server');
    await track('cache_result', { key: key.substring(0, 80), result });
  } catch {
    // No-op
  }
}
