/**
 * Arbiscan API helper tests
 * PROP-002: Retry logic, timeout, error handling
 */

import {
  fetchWithRetry,
  fetchNativeTransactions,
  fetchTokenTransactions,
  InvalidApiKeyError,
  RateLimitError,
} from './arbiscan';

describe('Arbiscan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
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
  });
});
