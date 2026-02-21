/**
 * Trader Realtime Sync Service Tests
 * S7-005: Unit tests for traderRealtimeSyncService.js
 * Covers: syncTraderWalletRealtime, cleanupOldTraderPayouts, syncAllTradersRealtime
 */

import {
  syncTraderWalletRealtime,
  cleanupOldTraderPayouts,
  syncAllTradersRealtime,
} from '@/lib/services/traderRealtimeSyncService';
import { createClient } from '@supabase/supabase-js';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/arbiscan', () => ({
  fetchNativeTransactions: jest.fn(),
  fetchTokenTransactions: jest.fn(),
}));

describe('Trader Realtime Sync Service', () => {
  let mockSupabase;
  let mockFrom;
  let mockSelect;
  let mockNot;
  let mockUpsert;
  let mockDelete;
  let mockLt;
  let mockSelectHead;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.ARBISCAN_API_KEY = 'test-key';

    mockSelectHead = jest.fn().mockResolvedValue({ count: 0, error: null });
    mockLt = jest.fn().mockReturnValue({ select: mockSelectHead });
    mockDelete = jest.fn().mockReturnValue({ lt: mockLt });
    mockUpsert = jest.fn().mockResolvedValue({ error: null });
    mockNot = jest.fn().mockResolvedValue({ data: [], error: null });
    mockSelect = jest.fn().mockReturnValue({ not: mockNot });
    mockFrom = jest.fn((table) => {
      if (table === 'user_profiles') {
        return { select: mockSelect };
      }
      if (table === 'trader_recent_payouts') {
        return { upsert: mockUpsert, delete: mockDelete };
      }
      return {};
    });

    mockSupabase = { from: mockFrom };
    createClient.mockReturnValue(mockSupabase);

    fetchNativeTransactions.mockResolvedValue([]);
    fetchTokenTransactions.mockResolvedValue([]);
  });

  describe('syncTraderWalletRealtime', () => {
    it('returns zero newPayouts when no transactions in 24h', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const result = await syncTraderWalletRealtime('0xabc');
      expect(result.walletAddress).toBe('0xabc');
      expect(result.newPayouts).toBe(0);
      expect(result.error).toBeNull();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('upserts payouts and returns count when Arbiscan has data', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const nowSec = Math.floor(Date.now() / 1000);
      const inside24h = nowSec - 3600;
      fetchNativeTransactions.mockResolvedValue([
        {
          hash: '0xtx1',
          from: '0xfrom',
          to: '0xabc',
          value: '1000000000000000000',
          timeStamp: String(inside24h),
        },
      ]);

      const result = await syncTraderWalletRealtime('0xAbC');

      expect(result.newPayouts).toBe(1);
      expect(result.error).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('trader_recent_payouts');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tx_hash: '0xtx1',
            wallet_address: '0xabc',
            amount: 2500,
            payment_method: 'crypto',
          }),
        ]),
        { onConflict: 'tx_hash' }
      );
    });

    it('throws when ARBISCAN_API_KEY is missing', async () => {
      delete process.env.ARBISCAN_API_KEY;
      await expect(syncTraderWalletRealtime('0xabc')).rejects.toThrow('Missing ARBISCAN_API_KEY');
    });

    it('sets error when Arbiscan throws', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      fetchNativeTransactions.mockRejectedValue(new Error('API timeout'));
      const result = await syncTraderWalletRealtime('0xabc');
      expect(result.error).toContain('API timeout');
    });
  });

  describe('cleanupOldTraderPayouts', () => {
    it('calls delete with timestamp cutoff', async () => {
      const result = await cleanupOldTraderPayouts(24);
      expect(mockFrom).toHaveBeenCalledWith('trader_recent_payouts');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockLt).toHaveBeenCalledWith('timestamp', expect.any(String));
      expect(result.deleted).toBe(0);
      expect(result.error).toBeNull();
    });

    it('returns error when delete fails', async () => {
      mockSelectHead.mockResolvedValueOnce({ count: null, error: { message: 'DB error' } });

      const result = await cleanupOldTraderPayouts(24);
      expect(result.error).toBe('DB error');
      expect(result.deleted).toBe(0);
    });
  });

  describe('syncAllTradersRealtime', () => {
    it('returns empty summary when no trader profiles', async () => {
      mockNot.mockResolvedValue({ data: [], error: null });

      const result = await syncAllTradersRealtime();

      expect(result.wallets).toBe(0);
      expect(result.totalPayouts).toBe(0);
      expect(result.errors).toEqual([]);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockSelect).toHaveBeenCalledWith('id, wallet_address');
      expect(mockNot).toHaveBeenCalledWith('wallet_address', 'is', null);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('syncs one wallet and runs cleanup', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      mockNot.mockResolvedValue({
        data: [{ id: 'user-1', wallet_address: '0xone' }],
        error: null,
      });

      const result = await syncAllTradersRealtime();

      expect(result.wallets).toBe(1);
      expect(result.totalPayouts).toBe(0);
      expect(result.errors).toEqual([]);
      expect(fetchNativeTransactions).toHaveBeenCalledWith('0xone', 'test-key');
      expect(fetchTokenTransactions).toHaveBeenCalledWith('0xone', 'test-key');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws when profiles fetch fails', async () => {
      mockNot.mockResolvedValue({ data: null, error: { message: 'Connection failed' } });

      await expect(syncAllTradersRealtime()).rejects.toThrow(
        'Failed to fetch profiles: Connection failed'
      );
    });

    it('collects errors from failed wallet syncs', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      mockNot.mockResolvedValue({
        data: [{ id: 'user-1', wallet_address: '0xfail' }],
        error: null,
      });
      fetchNativeTransactions.mockRejectedValue(new Error('Rate limited'));

      const result = await syncAllTradersRealtime();

      expect(result.wallets).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].wallet).toBe('0xfail');
      expect(result.errors[0].error).toContain('Rate limited');
    });
  });
});
