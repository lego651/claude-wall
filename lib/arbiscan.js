/**
 * Arbiscan API Helper
 *
 * Fetches transaction data from Arbiscan (Arbitrum blockchain explorer)
 * using the Etherscan V2 API.
 *
 * - Retry: exponential backoff (1s, 2s, 4s), max 3 retries, 10s timeout per request.
 * - Circuit breaker: 5 consecutive failures → OPEN (block all requests); after 60s
 *   → HALF_OPEN (one trial); success → CLOSED, failure → OPEN again.
 *
 * API Docs: https://docs.etherscan.io/v2-migration
 */

import { logger } from '@/lib/logger';

const ARBISCAN_API_BASE = 'https://api.etherscan.io/v2/api';
const ARBITRUM_CHAIN_ID = '42161';

/** Arbiscan daily limit (Etherscan docs); used for usage percentage */
const ARBISCAN_DAILY_LIMIT = 100_000;

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];
const BACKOFF_MAX_MS = 30_000;

/** Thrown when API key is invalid; do not retry */
export class InvalidApiKeyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidApiKeyError';
  }
}

/** Thrown when rate limited; caller may retry with backoff */
export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Thrown when circuit breaker is OPEN and requests are blocked */
export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open') {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

const CIRCUIT_STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_TIMEOUT_MS = 60_000;

/**
 * Circuit breaker for Arbiscan API.
 * - CLOSED: normal operation; failures are counted.
 * - OPEN: after 5 consecutive failures, block all requests for 60s.
 * - HALF_OPEN: after 60s, allow one trial request; success → CLOSED, failure → OPEN.
 */
export class ArbiscanCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold ?? CIRCUIT_FAILURE_THRESHOLD;
    this.resetTimeoutMs = options.resetTimeoutMs ?? CIRCUIT_RESET_TIMEOUT_MS;
    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptAllowedAt = null;
  }

  /**
   * Execute an async function through the circuit breaker.
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async execute(fn) {
    this._maybeTransitionFromOpen();

    if (this.state === CIRCUIT_STATE.OPEN) {
      const err = new CircuitOpenError(
        `Arbiscan circuit open until ${new Date(this.nextAttemptAllowedAt).toISOString()}`
      );
      logger.warn({ context: 'arbiscan' }, 'Circuit breaker open, request blocked');
      throw err;
    }

    try {
      const result = await fn();
      this._recordSuccess();
      return result;
    } catch (err) {
      this._recordFailure();
      throw err;
    }
  }

  _maybeTransitionFromOpen() {
    if (this.state !== CIRCUIT_STATE.OPEN) return;
    const now = Date.now();
    if (now >= this.nextAttemptAllowedAt) {
      this.state = CIRCUIT_STATE.HALF_OPEN;
      this.failureCount = 0;
      logger.warn({ context: 'arbiscan' }, 'Circuit breaker half-open, allowing trial request');
    }
  }

  _recordSuccess() {
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.state = CIRCUIT_STATE.CLOSED;
      this.failureCount = 0;
      logger.warn({ context: 'arbiscan' }, 'Circuit breaker closed after successful trial');
    } else {
      this.failureCount = 0;
    }
  }

  _recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this._trip();
    } else if (this.failureCount >= this.failureThreshold) {
      this._trip();
    }
  }

  _trip() {
    this.state = CIRCUIT_STATE.OPEN;
    this.nextAttemptAllowedAt = Date.now() + this.resetTimeoutMs;
    logger.warn(
      { context: 'arbiscan', failureCount: this.failureCount, resetTimeoutMs: this.resetTimeoutMs },
      'Circuit breaker opened, retry after timeout'
    );
    // PROP-022: notify by email (fire-and-forget)
    import('@/lib/alerts').then((m) =>
      m.sendAlert('Arbiscan API', 'Circuit breaker opened - too many consecutive failures', 'CRITICAL', {
        failureCount: this.failureCount,
        resetTimeoutMs: this.resetTimeoutMs,
        nextAttemptAllowedAt: new Date(this.nextAttemptAllowedAt).toISOString(),
      })
    ).catch(() => {});
  }

  /** For tests: current state and counts */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptAllowedAt: this.nextAttemptAllowedAt,
    };
  }

  /** Reset to CLOSED (for tests only) */
  reset() {
    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptAllowedAt = null;
  }
}

const circuitBreaker = new ArbiscanCircuitBreaker();
export { circuitBreaker };

/**
 * Tracks daily Arbiscan API call count (UTC day). Resets at midnight UTC.
 * Alerts at 80%, 90%, 95% (log + optional Slack).
 */
export class ArbiscanUsageTracker {
  constructor(options = {}) {
    this.limit = options.limit ?? ARBISCAN_DAILY_LIMIT;
    this._calls = 0;
    this._dayKey = null; // YYYY-MM-DD UTC
    this._alertedThresholds = new Set(); // reset each day
  }

  /**
   * Record one API call. Call from fetchWithRetry (each attempt).
   * @returns {{ calls: number, limit: number, percentage: number, day: string }}
   */
  trackCall() {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    if (dayKey !== this._dayKey) {
      this._dayKey = dayKey;
      this._calls = 0;
      this._alertedThresholds.clear();
    }
    this._calls++;
    const usage = this.getUsage();
    this._maybeAlert(usage.percentage);
    return usage;
  }

  /**
   * Current usage (no side effect).
   * @returns {{ calls: number, limit: number, percentage: number, day: string }}
   */
  getUsage() {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    if (dayKey !== this._dayKey) {
      return { calls: 0, limit: this.limit, percentage: 0, day: dayKey };
    }
    const percentage = this.limit > 0 ? Math.round((this._calls / this.limit) * 100) : 0;
    return {
      calls: this._calls,
      limit: this.limit,
      percentage,
      day: this._dayKey,
    };
  }

  /**
   * Check usage and log / Slack if over threshold. Call after trackCall().
   * @param {number} usagePercentage
   */
  _maybeAlert(usagePercentage) {
    const thresholds = [80, 90, 95];
    for (const t of thresholds) {
      if (usagePercentage >= t && !this._alertedThresholds.has(t)) {
        this._alertedThresholds.add(t);
        const usage = this.getUsage();
        logger.warn(
          { context: 'arbiscan', ...usage },
          `Arbiscan usage at ${t}% (${usage.calls}/${usage.limit} calls today)`
        );
        this._sendSlackAlert(t, usage).catch(() => {});
      }
    }
  }

  async _sendSlackAlert(threshold, usage) {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `⚠️ Arbiscan usage at ${threshold}%: ${usage.calls}/${usage.limit} calls today (${usage.day})`,
      }),
    });
  }

  /** Reset daily count and alerts (for tests). */
  reset() {
    this._calls = 0;
    this._dayKey = null;
    this._alertedThresholds.clear();
  }
}

const usageTracker = new ArbiscanUsageTracker();
export { usageTracker };

/**
 * Run a promise with a timeout.
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(ms, BACKOFF_MAX_MS)));
}

/**
 * Execute an async request with retries and exponential backoff.
 * - Rate limit / network errors: retry up to MAX_RETRIES with backoff 1s, 2s, 4s.
 * - Invalid API key: throw immediately (no retry).
 * - No data (e.g. "No transactions found"): return empty array (not an error).
 *
 * @param {() => Promise<Array>} requestFn - Async function that performs one request; returns data array or throws
 * @param {{ context?: string }} options - Optional context for logging
 * @returns {Promise<Array>}
 */
export async function fetchWithRetry(requestFn, options = {}) {
  const { context = 'arbiscan' } = options;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    usageTracker.trackCall();
    try {
      const result = await withTimeout(requestFn(), DEFAULT_TIMEOUT_MS);
      return result;
    } catch (err) {
      lastError = err;

      if (err instanceof InvalidApiKeyError) {
        throw err;
      }

      if (attempt < MAX_RETRIES) {
        const delay = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
        logger.warn(
          { context: 'arbiscan', attempt: attempt + 1, maxRetries: MAX_RETRIES, requestContext: context, error: err.message },
          'Retry'
        );
        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

/**
 * Parse Arbiscan API JSON response into result array or throw/retry signals.
 * @param {object} data - Parsed API response
 * @param {string} address - Address (for logging)
 * @returns {{ result: Array } | { retry: true } | { invalidKey: true }}
 */
function parseArbiscanResponse(data, address) {
  if (data.status !== '0') {
    return { result: data.result || [] };
  }

  const msg = (data.message || '').toLowerCase();

  if (msg.includes('no transactions found') || msg.includes('no token transfers found')) {
    return { result: [] };
  }

  if (msg.includes('rate limit') || msg.includes('max rate limit')) {
    throw new RateLimitError(`Rate limit for ${address}`);
  }

  if (msg.includes('invalid api key') || data.message === 'NOTOK') {
    throw new InvalidApiKeyError(data.message || 'Invalid API Key');
  }

  return { result: [] };
}

/**
 * Fetch native ETH transactions for an address
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Arbiscan API key
 * @param {Object} [options] - Optional pagination params
 * @param {number} [options.page] - Page number (1-indexed)
 * @param {number} [options.offset] - Results per page (max 10000)
 * @returns {Promise<Array>} Array of native transactions
 */
export async function fetchNativeTransactions(address, apiKey, options = {}) {
  const { page, offset } = options;
  let url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;

  if (page !== undefined) {
    url += `&page=${page}`;
  }
  if (offset !== undefined) {
    url += `&offset=${offset}`;
  }

  return circuitBreaker.execute(() =>
    fetchWithRetry(
      async () => {
        const response = await fetch(url);
        const data = await response.json();

        if (response.status === 429) {
          throw new RateLimitError('HTTP 429');
        }

        const parsed = parseArbiscanResponse(data, address);
        if (parsed.result) return parsed.result;
        throw new Error('Unexpected response');
      },
      { context: `native ${address}` }
    )
  );
}

/**
 * Fetch ERC-20 token transactions for an address
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Arbiscan API key
 * @param {Object} [options] - Optional pagination params
 * @param {number} [options.page] - Page number (1-indexed)
 * @param {number} [options.offset] - Results per page (max 10000)
 * @returns {Promise<Array>} Array of token transactions
 */
export async function fetchTokenTransactions(address, apiKey, options = {}) {
  const { page, offset } = options;
  let url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;

  if (page !== undefined) {
    url += `&page=${page}`;
  }
  if (offset !== undefined) {
    url += `&offset=${offset}`;
  }

  return circuitBreaker.execute(() =>
    fetchWithRetry(
      async () => {
        const response = await fetch(url);
        const data = await response.json();

        if (response.status === 429) {
          throw new RateLimitError('HTTP 429');
        }

        const parsed = parseArbiscanResponse(data, address);
        if (parsed.result) return parsed.result;
        throw new Error('Unexpected response');
      },
      { context: `token ${address}` }
    )
  );
}

/**
 * Fetch ALL native ETH transactions for an address via pagination
 * Continues fetching pages until we get fewer than 10k results or hit the cutoff timestamp
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Arbiscan API key
 * @param {Object} [options] - Fetch options
 * @param {number} [options.cutoffTimestamp] - Unix timestamp (seconds); stop fetching when oldest tx is before this
 * @param {number} [options.delayMs=500] - Delay between pages to avoid rate limiting
 * @returns {Promise<Array>} All native transactions (newest first)
 */
export async function fetchAllNativeTransactions(address, apiKey, options = {}) {
  const { cutoffTimestamp, delayMs = 500 } = options;
  const allTransactions = [];
  let page = 1;
  const offset = 10000;

  logger.info(
    { context: 'arbiscan', address, cutoffTimestamp },
    'Starting fetchAllNativeTransactions (pagination)'
  );

  while (true) {
    const txs = await fetchNativeTransactions(address, apiKey, { page, offset });

    if (txs.length === 0) {
      logger.info({ context: 'arbiscan', address, page, total: allTransactions.length }, 'No more native txs');
      break;
    }

    allTransactions.push(...txs);
    logger.info(
      { context: 'arbiscan', address, page, fetched: txs.length, total: allTransactions.length },
      'Fetched native tx page'
    );

    // Check if we hit the cutoff
    if (cutoffTimestamp && txs.length > 0) {
      const oldestTx = txs[txs.length - 1];
      const oldestTimestamp = parseInt(oldestTx.timeStamp);
      if (oldestTimestamp < cutoffTimestamp) {
        logger.info(
          { context: 'arbiscan', address, page, oldestTimestamp, cutoffTimestamp, total: allTransactions.length },
          'Hit cutoff timestamp for native txs'
        );
        break;
      }
    }

    // Stop if we got fewer than max results
    if (txs.length < offset) {
      logger.info(
        { context: 'arbiscan', address, page, fetched: txs.length, total: allTransactions.length },
        'Got last page of native txs (< 10k)'
      );
      break;
    }

    // Rate limit: delay before next page
    await sleep(delayMs);
    page++;
  }

  // Filter out transactions older than cutoff (final cleanup)
  if (cutoffTimestamp) {
    const filtered = allTransactions.filter(tx => parseInt(tx.timeStamp) >= cutoffTimestamp);
    logger.info(
      { context: 'arbiscan', address, total: allTransactions.length, filtered: filtered.length },
      'Filtered native txs by cutoff'
    );
    return filtered;
  }

  return allTransactions;
}

/**
 * Fetch ALL ERC-20 token transactions for an address via pagination
 * Continues fetching pages until we get fewer than 10k results or hit the cutoff timestamp
 *
 * @param {string} address - Wallet address (0x...)
 * @param {string} apiKey - Arbiscan API key
 * @param {Object} [options] - Fetch options
 * @param {number} [options.cutoffTimestamp] - Unix timestamp (seconds); stop fetching when oldest tx is before this
 * @param {number} [options.delayMs=500] - Delay between pages to avoid rate limiting
 * @returns {Promise<Array>} All token transactions (newest first)
 */
export async function fetchAllTokenTransactions(address, apiKey, options = {}) {
  const { cutoffTimestamp, delayMs = 500 } = options;
  const allTransactions = [];
  let page = 1;
  const offset = 10000;

  logger.info(
    { context: 'arbiscan', address, cutoffTimestamp },
    'Starting fetchAllTokenTransactions (pagination)'
  );

  while (true) {
    const txs = await fetchTokenTransactions(address, apiKey, { page, offset });

    if (txs.length === 0) {
      logger.info({ context: 'arbiscan', address, page, total: allTransactions.length }, 'No more token txs');
      break;
    }

    allTransactions.push(...txs);
    logger.info(
      { context: 'arbiscan', address, page, fetched: txs.length, total: allTransactions.length },
      'Fetched token tx page'
    );

    // Check if we hit the cutoff
    if (cutoffTimestamp && txs.length > 0) {
      const oldestTx = txs[txs.length - 1];
      const oldestTimestamp = parseInt(oldestTx.timeStamp);
      if (oldestTimestamp < cutoffTimestamp) {
        logger.info(
          { context: 'arbiscan', address, page, oldestTimestamp, cutoffTimestamp, total: allTransactions.length },
          'Hit cutoff timestamp for token txs'
        );
        break;
      }
    }

    // Stop if we got fewer than max results
    if (txs.length < offset) {
      logger.info(
        { context: 'arbiscan', address, page, fetched: txs.length, total: allTransactions.length },
        'Got last page of token txs (< 10k)'
      );
      break;
    }

    // Rate limit: delay before next page
    await sleep(delayMs);
    page++;
  }

  // Filter out transactions older than cutoff (final cleanup)
  if (cutoffTimestamp) {
    const filtered = allTransactions.filter(tx => parseInt(tx.timeStamp) >= cutoffTimestamp);
    logger.info(
      { context: 'arbiscan', address, total: allTransactions.length, filtered: filtered.length },
      'Filtered token txs by cutoff'
    );
    return filtered;
  }

  return allTransactions;
}
