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
 * @returns {Promise<Array>} Array of native transactions
 */
export async function fetchNativeTransactions(address, apiKey) {
  const url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`;

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
 * @returns {Promise<Array>} Array of token transactions
 */
export async function fetchTokenTransactions(address, apiKey) {
  const url = `${ARBISCAN_API_BASE}?chainid=${ARBITRUM_CHAIN_ID}&module=account&action=tokentx&address=${address}&sort=desc&apikey=${apiKey}`;

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
