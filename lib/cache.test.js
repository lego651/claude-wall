/**
 * PROP-013: Unit tests for lib/cache
 */

const mockKvClient = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  scanIterator: jest.fn(function* () {}),
};

jest.mock('@vercel/kv', () => ({
  createClient: jest.fn(() => mockKvClient),
}));

import { get, set, invalidate, cache } from '@/lib/cache';

const originalEnv = process.env;

describe('lib/cache', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    mockKvClient.get.mockResolvedValue(null);
    mockKvClient.set.mockResolvedValue(undefined);
    mockKvClient.del.mockResolvedValue(undefined);
    mockKvClient.scanIterator.mockImplementation(function* () {});
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exports get, set, invalidate and cache object', () => {
    expect(typeof get).toBe('function');
    expect(typeof set).toBe('function');
    expect(typeof invalidate).toBe('function');
    expect(cache).toEqual({ get, set, invalidate });
  });

  it('get returns null when KV env is not set', async () => {
    const result = await get('any-key');
    expect(result).toBeNull();
  });

  it('set does not throw when KV env is not set', async () => {
    await expect(set('key', { x: 1 }, 60)).resolves.toBeUndefined();
  });

  it('invalidate does not throw when KV env is not set', async () => {
    await expect(invalidate('prefix:*')).resolves.toBeUndefined();
  });

  describe('with KV configured', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://kv.test';
      process.env.KV_REST_API_TOKEN = 'token';
    });

    it('get returns value on hit', async () => {
      mockKvClient.get.mockResolvedValueOnce({ cached: true });
      const result = await get('key');
      expect(result).toEqual({ cached: true });
      expect(mockKvClient.get).toHaveBeenCalledWith('key');
    });

    it('get returns null on miss', async () => {
      mockKvClient.get.mockResolvedValueOnce(null);
      const result = await get('key');
      expect(result).toBeNull();
    });

    it('set calls kv.set with key, value, and ex', async () => {
      await set('k', { x: 1 }, 300);
      expect(mockKvClient.set).toHaveBeenCalledWith('k', { x: 1 }, { ex: 300 });
    });

    it('invalidate scans and deletes matching keys', async () => {
      const iterator = (function* () {
        yield 'propfirms:7d';
        yield 'propfirms:30d';
      })();
      mockKvClient.scanIterator.mockReturnValueOnce(iterator);
      await invalidate('propfirms:*');
      expect(mockKvClient.scanIterator).toHaveBeenCalledWith({ match: 'propfirms:*', count: 100 });
      expect(mockKvClient.del).toHaveBeenCalledWith('propfirms:7d');
      expect(mockKvClient.del).toHaveBeenCalledWith('propfirms:30d');
    });
  });
});
