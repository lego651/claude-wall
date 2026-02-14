/**
 * Arbiscan API helper tests
 * PROP-002: Retry logic, timeout, error handling
 * PROP-003: Circuit breaker
 * PROP-009: API integration tests (mocked responses)
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  fetchWithRetry,
  fetchNativeTransactions,
  fetchTokenTransactions,
  fetchAllNativeTransactions,
  fetchAllTokenTransactions,
  InvalidApiKeyError,
  RateLimitError,
  CircuitOpenError,
  ArbiscanCircuitBreaker,
  circuitBreaker,
  usageTracker,
  ArbiscanUsageTracker,
} from '@/lib/arbiscan';

describe('Arbiscan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    circuitBreaker.reset();
    usageTracker.reset();
  });

  describe('fetchWithRetry', () => {
    it('succeeds on first try', async () => {
      const data = [1, 2, 3];
      await expect(
        fetchWithRetry(async () => data)
      ).resolves.toEqual(data);
    });

    it('retries on rate limit error and then succeeds', async () => {
      const data = [];
      let calls = 0;
      const fn = async () => {
        calls++;
        if (calls < 2) throw new RateLimitError('rate limit');
        return data;
      };
      await expect(fetchWithRetry(fn)).resolves.toEqual(data);
      expect(calls).toBe(2);
    });

    it('throws after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(fetchWithRetry(fn)).rejects.toThrow('Network error');
      expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('does not retry on invalid API key', async () => {
      const fn = async () => {
        throw new InvalidApiKeyError('Invalid API Key');
      };
      await expect(fetchWithRetry(fn)).rejects.toThrow(InvalidApiKeyError);
      await expect(fetchWithRetry(fn)).rejects.toThrow('Invalid API Key');
    });

    it('retries on timeout error and throws after max retries', async () => {
      const timeoutErr = new Error('Request timeout');
      const fn = jest
        .fn()
        .mockRejectedValueOnce(timeoutErr)
        .mockRejectedValueOnce(timeoutErr)
        .mockRejectedValueOnce(timeoutErr)
        .mockRejectedValueOnce(timeoutErr);
      await expect(fetchWithRetry(fn)).rejects.toThrow('Request timeout');
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('logs retry attempts', async () => {
      const { logger } = require('@/lib/logger');
      let calls = 0;
      const fn = async () => {
        calls++;
        if (calls < 2) throw new RateLimitError('rate limit');
        return [];
      };
      await fetchWithRetry(fn);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 1, maxRetries: 3 }),
        'Retry'
      );
    });

    it('uses exponential backoff between retries', async () => {
      jest.useFakeTimers();
      let attemptTimes = [];
      const fn = async () => {
        attemptTimes.push(Date.now());
        if (attemptTimes.length < 3) throw new RateLimitError('rate limit');
        return [];
      };
      const p = fetchWithRetry(fn);
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await p;
      expect(attemptTimes.length).toBe(3);
      if (attemptTimes[1] !== undefined && attemptTimes[2] !== undefined) {
        expect(attemptTimes[1] - attemptTimes[0]).toBe(1000);
        expect(attemptTimes[2] - attemptTimes[1]).toBe(2000);
      }
      jest.useRealTimers();
    }, 5000);
  });

  describe('fetchNativeTransactions', () => {
    it('returns result array when status is 1', async () => {
      const txs = [{ hash: '0x1' }];
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: txs }),
      });

      const result = await fetchNativeTransactions('0xabc', 'key');
      expect(result).toEqual(txs);
    });

    it('returns empty array when no transactions found', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '0', message: 'No transactions found' }),
      });

      const result = await fetchNativeTransactions('0xabc', 'key');
      expect(result).toEqual([]);
    });

    it('throws InvalidApiKeyError on invalid API key', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '0', message: 'Invalid API Key' }),
      });

      await expect(fetchNativeTransactions('0xabc', 'bad')).rejects.toThrow(InvalidApiKeyError);
    });

    it('retries on rate limit then returns data', async () => {
      const txs = [{ hash: '0x2' }];
      fetch
        .mockResolvedValueOnce({
          status: 429,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: '1', result: txs }),
        });

      const result = await fetchNativeTransactions('0xabc', 'key');
      expect(result).toEqual(txs);
      expect(fetch).toHaveBeenCalledTimes(2);
    }, 5000);

  });

  describe('fetchTokenTransactions', () => {
    it('returns result array when status is 1', async () => {
      const txs = [{ hash: '0xt', tokenSymbol: 'USDC' }];
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: txs }),
      });

      const result = await fetchTokenTransactions('0xabc', 'key');
      expect(result).toEqual(txs);
    });

    it('returns empty array when no token transfers found', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '0', message: 'No token transfers found' }),
      });

      const result = await fetchTokenTransactions('0xabc', 'key');
      expect(result).toEqual([]);
    });

    it('throws InvalidApiKeyError on NOTOK', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '0', message: 'NOTOK' }),
      });

      await expect(fetchTokenTransactions('0xabc', 'bad')).rejects.toThrow(InvalidApiKeyError);
    });

    it('retries on rate limit then returns data', async () => {
      const txs = [{ hash: '0xt', tokenSymbol: 'USDC' }];
      fetch
        .mockResolvedValueOnce({
          status: 429,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: '1', result: txs }),
        });

      const result = await fetchTokenTransactions('0xabc', 'key');
      expect(result).toEqual(txs);
      expect(fetch).toHaveBeenCalledTimes(2);
    }, 5000);

    it('includes page and offset in URL when provided', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: [] }),
      });
      await fetchTokenTransactions('0xabc', 'key', { page: 2, offset: 500 });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=500'));
    });
  });

  describe('fetchNativeTransactions pagination params', () => {
    it('includes page and offset in URL when provided', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: [] }),
      });
      await fetchNativeTransactions('0xabc', 'key', { page: 2, offset: 500 });
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('page=2'));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('offset=500'));
    });
  });

  describe('parseArbiscanResponse (via fetch)', () => {
    it('returns empty array when status is 0 and message is unknown', async () => {
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '0', message: 'Unknown error' }),
      });
      const result = await fetchNativeTransactions('0xabc', 'key');
      expect(result).toEqual([]);
    });

    it('returns empty array for rate limit message variant', async () => {
      fetch.mockResolvedValue({
        status: 200,
        json: async () => ({ status: '0', message: 'Max rate limit reached' }),
      });
      await expect(fetchNativeTransactions('0xabc', 'key')).rejects.toThrow(RateLimitError);
    });
  });

  describe('ArbiscanUsageTracker alerts', () => {
    it('calls logger.warn when usage reaches 80%', () => {
      const { logger } = require('@/lib/logger');
      const tracker = new ArbiscanUsageTracker({ limit: 10 });
      for (let i = 0; i < 8; i++) tracker.trackCall();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'arbiscan', percentage: 80 }),
        expect.stringMatching(/80%.*8\/10/)
      );
    });

    it('getUsage returns 0 when day changed', () => {
      const tracker = new ArbiscanUsageTracker({ limit: 100 });
      tracker.trackCall();
      tracker._dayKey = '2000-01-01';
      const u = tracker.getUsage();
      expect(u.calls).toBe(0);
      expect(u.percentage).toBe(0);
    });

    it('sends Slack alert when SLACK_WEBHOOK_URL is set and usage >= 80%', async () => {
      const orig = process.env.SLACK_WEBHOOK_URL;
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      fetch.mockResolvedValueOnce({ ok: true });
      const tracker = new ArbiscanUsageTracker({ limit: 10 });
      for (let i = 0; i < 8; i++) tracker.trackCall();
      await new Promise((r) => setTimeout(r, 50));
      expect(fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      const body = JSON.parse(fetch.mock.calls[findSlackCall()][1].body);
      expect(body.text).toMatch(/80%.*8\/10/);
      process.env.SLACK_WEBHOOK_URL = orig;
    });
  });

  function findSlackCall() {
    for (let i = 0; i < fetch.mock.calls.length; i++) {
      if (fetch.mock.calls[i][0]?.includes?.('slack')) return i;
    }
    return 0;
  }

  describe('fetchAllNativeTransactions', () => {
    it('returns single page and stops when no more txs', async () => {
      const txs = [{ hash: '0x1', timeStamp: '1704067200' }];
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: txs }),
      });
      const result = await fetchAllNativeTransactions('0xabc', 'key', { delayMs: 0 });
      expect(result).toEqual(txs);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('paginates until page has fewer than 10k results', async () => {
      const page1 = Array(10000).fill(null).map((_, i) => ({ hash: `0x${i}`, timeStamp: String(1704067200 + i) }));
      const page2 = [{ hash: '0xlast', timeStamp: '1704067199' }];
      fetch
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: '1', result: page1 }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: '1', result: page2 }),
        });
      const result = await fetchAllNativeTransactions('0xabc', 'key', { delayMs: 0 });
      expect(result).toHaveLength(10001);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('stops at cutoffTimestamp and filters result', async () => {
      const cutoff = 1704067200;
      const txs = [
        { hash: '0x1', timeStamp: String(cutoff + 100) },
        { hash: '0x2', timeStamp: String(cutoff - 100) },
      ];
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: txs }),
      });
      const result = await fetchAllNativeTransactions('0xabc', 'key', { cutoffTimestamp: cutoff, delayMs: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('0x1');
    });
  });

  describe('fetchAllTokenTransactions', () => {
    it('returns single page and stops when no more txs', async () => {
      const txs = [{ hash: '0x1', timeStamp: '1704067200', tokenSymbol: 'USDC' }];
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: txs }),
      });
      const result = await fetchAllTokenTransactions('0xabc', 'key', { delayMs: 0 });
      expect(result).toEqual(txs);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('paginates until page has fewer than 10k results', async () => {
      const page1 = Array(10000).fill(null).map((_, i) => ({ hash: `0x${i}`, timeStamp: String(1704067200 + i), tokenSymbol: 'USDC' }));
      const page2 = [{ hash: '0xlast', timeStamp: '1704067199', tokenSymbol: 'USDC' }];
      fetch
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: '1', result: page1 }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ status: '1', result: page2 }),
        });
      const result = await fetchAllTokenTransactions('0xabc', 'key', { delayMs: 0 });
      expect(result).toHaveLength(10001);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('stops at cutoffTimestamp and filters result', async () => {
      const cutoff = 1704067200;
      const txs = [
        { hash: '0x1', timeStamp: String(cutoff + 100), tokenSymbol: 'USDC' },
        { hash: '0x2', timeStamp: String(cutoff - 100), tokenSymbol: 'USDC' },
      ];
      fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: '1', result: txs }),
      });
      const result = await fetchAllTokenTransactions('0xabc', 'key', { cutoffTimestamp: cutoff, delayMs: 0 });
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('0x1');
    });
  });

  describe('ArbiscanCircuitBreaker', () => {
    it('starts CLOSED and executes fn', async () => {
      const cb = new ArbiscanCircuitBreaker();
      const fn = jest.fn().mockResolvedValue(42);
      await expect(cb.execute(fn)).resolves.toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(cb.getState().state).toBe('CLOSED');
    });

    it('resets failure count on success', async () => {
      const cb = new ArbiscanCircuitBreaker({ failureThreshold: 3 });
      const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok');
      await expect(cb.execute(fn)).rejects.toThrow('fail');
      await expect(cb.execute(fn)).resolves.toBe('ok');
      expect(cb.getState().failureCount).toBe(0);
    });

    it('opens after threshold consecutive failures', async () => {
      const cb = new ArbiscanCircuitBreaker({ failureThreshold: 3 });
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(fn)).rejects.toThrow('fail');
      }
      expect(cb.getState().state).toBe('OPEN');
      await expect(cb.execute(() => Promise.resolve(1))).rejects.toThrow(CircuitOpenError);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws CircuitOpenError when OPEN without calling fn', async () => {
      const cb = new ArbiscanCircuitBreaker({ failureThreshold: 2 });
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      await cb.execute(fn).catch(() => {});
      await cb.execute(fn).catch(() => {});
      const innerFn = jest.fn();
      await expect(cb.execute(innerFn)).rejects.toThrow(CircuitOpenError);
      expect(innerFn).not.toHaveBeenCalled();
    });

    it('transitions to HALF_OPEN after reset timeout', async () => {
      jest.useFakeTimers();
      const cb = new ArbiscanCircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(cb.getState().state).toBe('OPEN');
      await jest.advanceTimersByTimeAsync(1100);
      const fn = jest.fn().mockResolvedValue('ok');
      await expect(cb.execute(fn)).resolves.toBe('ok');
      expect(cb.getState().state).toBe('CLOSED');
      jest.useRealTimers();
    });

    it('HALF_OPEN success closes circuit', async () => {
      jest.useFakeTimers();
      const cb = new ArbiscanCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 500 });
      await cb.execute(() => Promise.reject(new Error())).catch(() => {});
      jest.advanceTimersByTime(600);
      await expect(cb.execute(() => Promise.resolve('ok'))).resolves.toBe('ok');
      expect(cb.getState().state).toBe('CLOSED');
      jest.useRealTimers();
    });

    it('HALF_OPEN failure reopens circuit', async () => {
      jest.useFakeTimers();
      const cb = new ArbiscanCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 500 });
      await cb.execute(() => Promise.reject(new Error())).catch(() => {});
      jest.advanceTimersByTime(600);
      await cb.execute(() => Promise.reject(new Error())).catch(() => {});
      expect(cb.getState().state).toBe('OPEN');
      jest.useRealTimers();
    });

    it('getState returns state and counts', async () => {
      const cb = new ArbiscanCircuitBreaker({ failureThreshold: 2 });
      expect(cb.getState()).toMatchObject({ state: 'CLOSED', failureCount: 0 });
      await cb.execute(() => Promise.reject(new Error())).catch(() => {});
      expect(cb.getState().failureCount).toBe(1);
      await cb.execute(() => Promise.reject(new Error())).catch(() => {});
      expect(cb.getState()).toMatchObject({ state: 'OPEN', failureCount: 2 });
      expect(cb.getState().nextAttemptAllowedAt).toBeDefined();
    });
  });

  describe('ArbiscanUsageTracker', () => {
    it('trackCall increments count and returns usage', () => {
      const tracker = new ArbiscanUsageTracker({ limit: 100 });
      const u1 = tracker.trackCall();
      expect(u1.calls).toBe(1);
      expect(u1.limit).toBe(100);
      expect(u1.percentage).toBe(1);
      expect(u1.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const u2 = tracker.trackCall();
      expect(u2.calls).toBe(2);
      expect(u2.percentage).toBe(2);
    });

    it('getUsage returns current usage without incrementing', () => {
      const tracker = new ArbiscanUsageTracker({ limit: 100 });
      tracker.trackCall();
      tracker.trackCall();
      const u = tracker.getUsage();
      expect(u.calls).toBe(2);
      expect(u.limit).toBe(100);
      expect(u.percentage).toBe(2);
    });

    it('reset clears count', () => {
      const tracker = new ArbiscanUsageTracker({ limit: 100 });
      tracker.trackCall();
      tracker.trackCall();
      tracker.reset();
      const u = tracker.getUsage();
      expect(u.calls).toBe(0);
      expect(u.percentage).toBe(0);
    });
  });
});
