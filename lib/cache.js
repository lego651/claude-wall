/**
 * Response cache helper using Vercel KV (Redis).
 * When KV_REST_API_URL and KV_REST_API_TOKEN are not set, get/set/invalidate are no-ops (get returns null).
 */

import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'cache' });

let _kvClient = null;
let _kvInitPromise = null;

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  if (_kvClient) return _kvClient;
  if (_kvInitPromise) return _kvInitPromise;
  _kvInitPromise = (async () => {
    try {
      const { createClient } = await import('@vercel/kv');
      _kvClient = createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
      return _kvClient;
    } catch (err) {
      log.warn({ error: err.message }, 'KV client init failed');
      _kvInitPromise = null;
      return null;
    }
  })();
  return _kvInitPromise;
}

/**
 * Retrieve value from cache.
 * @param {string} key - Cache key
 * @returns {Promise<unknown|null>} Parsed value or null if miss/disabled
 */
export async function get(key) {
  const kv = await getKv();
  if (!kv) return null;
  try {
    const value = await kv.get(key);
    if (value !== null && value !== undefined) {
      log.debug({ key }, 'cache hit');
      return value;
    }
    log.debug({ key }, 'cache miss');
    return null;
  } catch (err) {
    log.warn({ key, error: err.message }, 'cache get error');
    return null;
  }
}

/**
 * Store value in cache with TTL.
 * @param {string} key - Cache key
 * @param {unknown} value - Serializable value (JSON)
 * @param {number} ttlSeconds - Time to live in seconds
 */
export async function set(key, value, ttlSeconds) {
  const kv = await getKv();
  if (!kv) return;
  try {
    await kv.set(key, value, { ex: ttlSeconds });
    log.debug({ key, ttlSeconds }, 'cache set');
  } catch (err) {
    log.warn({ key, error: err.message }, 'cache set error');
  }
}

/**
 * Invalidate keys matching a pattern (e.g. "propfirms:*").
 * Uses SCAN with MATCH and DEL for each key.
 * @param {string} pattern - Redis glob pattern (e.g. "propfirms:*")
 */
export async function invalidate(pattern) {
  const kv = await getKv();
  if (!kv) return;
  try {
    let deleted = 0;
    for await (const key of kv.scanIterator({ match: pattern, count: 100 })) {
      await kv.del(key);
      deleted++;
    }
    if (deleted > 0) log.info({ pattern, deleted }, 'cache invalidate');
  } catch (err) {
    log.warn({ pattern, error: err.message }, 'cache invalidate error');
  }
}

export const cache = { get, set, invalidate };
