/**
 * Arbiscan API Helper
 *
 * Fetches transaction data from Arbiscan (Arbitrum blockchain explorer)
 * using the Etherscan V2 API. Includes retry with exponential backoff and timeout.
 *
 * API Docs: https://docs.etherscan.io/v2-migration
 */

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
        if (typeof console.warn === 'function') {
          console.warn(`[Arbiscan] Retry ${attempt + 1}/${MAX_RETRIES} for ${context}:`, err.message);
        }
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

  return fetchWithRetry(
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

  return fetchWithRetry(
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
  );
}
