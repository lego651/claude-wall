/**
 * Alchemy API helper tests
 */

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  fetchAssetTransfers,
  fetchAllAssetTransfers,
  alchemyTransferToPayout,
} from '@/lib/alchemy';

describe('Alchemy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe('fetchAssetTransfers', () => {
    it('returns transfers and pageKey on success', async () => {
      const transfers = [
        { hash: '0x1', from: '0xa', to: '0xb', category: 'erc20', value: '100', asset: 'USDC', blockNum: '0x100', metadata: { blockTimestamp: '2025-01-01T12:00:00Z' } },
      ];
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { transfers, pageKey: 'next-page' } }),
      });

      const result = await fetchAssetTransfers('0xabc', 'api-key');
      expect(result).toEqual({ transfers, pageKey: 'next-page' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('arb-mainnet.g.alchemy.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.method).toBe('alchemy_getAssetTransfers');
      expect(body.params[0].fromAddress).toBe('0xabc');
      expect(body.params[0].fromBlock).toBe('0x0');
      expect(body.params[0].toBlock).toBe('latest');
      expect(body.params[0].order).toBe('desc');
      expect(body.params[0].excludeZeroValue).toBe(true);
    });

    it('passes category as array when string', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { transfers: [], pageKey: null } }),
      });
      await fetchAssetTransfers('0xabc', 'key', { category: 'erc20' });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.params[0].category).toEqual(['erc20']);
    });

    it('passes category as array when already array', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { transfers: [], pageKey: null } }),
      });
      await fetchAssetTransfers('0xabc', 'key', { category: ['external', 'erc20'] });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.params[0].category).toEqual(['external', 'erc20']);
    });

    it('passes fromBlock, toBlock, pageKey when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { transfers: [], pageKey: null } }),
      });
      await fetchAssetTransfers('0xabc', 'key', {
        fromBlock: '0x100',
        toBlock: '0x200',
        pageKey: 'pkey',
      });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.params[0].fromBlock).toBe('0x100');
      expect(body.params[0].toBlock).toBe('0x200');
      expect(body.params[0].pageKey).toBe('pkey');
    });

    it('throws on HTTP error', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });
      await expect(fetchAssetTransfers('0xabc', 'key')).rejects.toThrow('Alchemy API error: 500 Internal Server Error');
    });

    it('throws on API error in JSON', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: { message: 'Rate limited' } }),
      });
      await expect(fetchAssetTransfers('0xabc', 'key')).rejects.toThrow('Alchemy API error: Rate limited');
    });

    it('returns empty transfers when result is missing', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      const result = await fetchAssetTransfers('0xabc', 'key');
      expect(result).toEqual({ transfers: [], pageKey: undefined });
    });
  });

  describe('fetchAllAssetTransfers', () => {
    it('stops when first page returns no transfers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { transfers: [], pageKey: null } }),
      });
      const result = await fetchAllAssetTransfers('0xabc', 'key');
      expect(result).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('aggregates multiple pages and stops when no pageKey', async () => {
      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              transfers: [{ hash: '0x1' }],
              pageKey: 'p2',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            result: {
              transfers: [{ hash: '0x2' }],
              pageKey: null,
            },
          }),
        });
      const result = await fetchAllAssetTransfers('0xabc', 'key', { delayMs: 0 });
      expect(result).toHaveLength(2);
      expect(result[0].hash).toBe('0x1');
      expect(result[1].hash).toBe('0x2');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('stops at cutoffTimestamp when oldest transfer is before cutoff', async () => {
      const oldTs = '2024-06-01T00:00:00Z';
      const cutoff = new Date('2024-07-01').getTime() / 1000;
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            transfers: [
              { hash: '0x1', blockNum: '0x100', metadata: { blockTimestamp: '2024-08-01T00:00:00Z' } },
              { hash: '0x2', blockNum: '0x100', metadata: { blockTimestamp: oldTs } },
            ],
            pageKey: 'p2',
          },
        }),
      });
      const result = await fetchAllAssetTransfers('0xabc', 'key', {
        cutoffTimestamp: cutoff,
        delayMs: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('0x1');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('filters by cutoffTimestamp in final cleanup', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            transfers: [
              { hash: '0x1', blockNum: '0x100', metadata: { blockTimestamp: '2024-08-01T00:00:00Z' } },
              { hash: '0x2', blockNum: '0x100', metadata: { blockTimestamp: '2024-06-01T00:00:00Z' } },
            ],
            pageKey: null,
          },
        }),
      });
      const cutoff = new Date('2024-07-01').getTime() / 1000;
      const result = await fetchAllAssetTransfers('0xabc', 'key', { cutoffTimestamp: cutoff });
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('0x1');
    });

    it('keeps transfers without blockTimestamp when filtering by cutoff', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            transfers: [
              { hash: '0x1', metadata: {} },
              { hash: '0x2', metadata: { blockTimestamp: '2024-08-01T00:00:00Z' } },
            ],
            pageKey: null,
          },
        }),
      });
      const cutoff = new Date('2024-07-01').getTime() / 1000;
      const result = await fetchAllAssetTransfers('0xabc', 'key', { cutoffTimestamp: cutoff });
      expect(result).toHaveLength(2);
    });
  });

  describe('alchemyTransferToPayout', () => {
    it('returns null when transfer has no from', () => {
      expect(alchemyTransferToPayout({ to: '0xb' }, 'firm1')).toBeNull();
    });

    it('converts external (ETH) transfer', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'external',
        value: '2',
        blockNum: '0x100',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      const out = alchemyTransferToPayout(transfer, 'firm1');
      expect(out).toMatchObject({
        tx_hash: '0xh',
        firm_id: 'firm1',
        amount: 5000,
        payment_method: 'crypto',
        from_address: '0xa',
        to_address: '0xb',
      });
      expect(out.timestamp).toBe('2025-01-01T12:00:00.000Z');
    });

    it('converts erc20 RISEPAY transfer', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'erc20',
        value: '5000',
        asset: 'RISEPAY',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      const out = alchemyTransferToPayout(transfer, 'firm1');
      expect(out).toMatchObject({
        amount: 5000,
        payment_method: 'rise',
      });
    });

    it('converts erc20 USDC transfer', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'erc20',
        value: '1000',
        asset: 'USDC',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      const out = alchemyTransferToPayout(transfer, 'firm1');
      expect(out).toMatchObject({
        amount: 1000,
        payment_method: 'crypto',
      });
    });

    it('converts erc20 USDT transfer', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'erc20',
        value: '500',
        asset: 'USDT',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      const out = alchemyTransferToPayout(transfer, 'firm1');
      expect(out).toMatchObject({
        amount: 500,
        payment_method: 'crypto',
      });
    });

    it('returns null for unknown token symbol', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'erc20',
        value: '100',
        asset: 'UNKNOWN',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      expect(alchemyTransferToPayout(transfer, 'firm1')).toBeNull();
    });

    it('returns null for amount < 10', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'erc20',
        value: '5',
        asset: 'USDC',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      expect(alchemyTransferToPayout(transfer, 'firm1')).toBeNull();
    });

    it('uses blockNum for timestamp when metadata.blockTimestamp missing', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'external',
        value: '1',
        blockNum: '0x100',
        metadata: {},
      };
      const out = alchemyTransferToPayout(transfer, 'firm1');
      expect(out.timestamp).toBeDefined();
      expect(out.amount).toBe(2500);
    });

    it('handles erc721 and erc1155 as token category', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'erc721',
        value: '100',
        asset: 'USDC',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      const out = alchemyTransferToPayout(transfer, 'firm1');
      expect(out).toMatchObject({ amount: 100, payment_method: 'crypto' });
    });

    it('handles value 0 or missing for token', () => {
      const transfer = {
        from: '0xa',
        to: '0xb',
        hash: '0xh',
        category: 'erc20',
        value: undefined,
        asset: 'USDC',
        metadata: { blockTimestamp: '2025-01-01T12:00:00.000Z' },
      };
      const out = alchemyTransferToPayout(transfer, 'firm1');
      expect(out).toBeNull();
    });
  });
});
