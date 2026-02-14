/**
 * Payout Sync Service Tests
 * PROP-010: Unit tests for payoutSyncService.js
 * Covers: processPayouts, syncFirmPayouts, cleanupOldPayouts, syncAllFirms
 */

import {
  processPayouts,
  syncFirmPayouts,
  cleanupOldPayouts,
  syncAllFirms,
  updateFirmLastPayout,
} from '@/lib/services/payoutSyncService';
import { createClient } from '@supabase/supabase-js';
import { fetchNativeTransactions, fetchTokenTransactions } from '@/lib/arbiscan';

// Mock external dependencies
jest.mock('@supabase/supabase-js');
jest.mock('@/lib/arbiscan', () => ({
  fetchNativeTransactions: jest.fn(),
  fetchTokenTransactions: jest.fn(),
  usageTracker: {
    getUsage: jest.fn().mockReturnValue({ calls: 0, limit: 100000, percentage: 0, day: '2025-01-01' }),
  },
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Payout Sync Service', () => {
  let mockSupabase;
  let mockFrom;
  let mockSelect;
  let mockUpsert;
  let mockDelete;
  let mockUpdate;
  let mockEq;
  let mockLt;
  let mockSingle;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create mock chain for Supabase query builder
    mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    mockLt = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    });
    mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockUpsert = jest.fn().mockResolvedValue({ data: [], error: null });
    mockDelete = jest.fn().mockReturnValue({ lt: mockLt });
    mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom = jest.fn().mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
      delete: mockDelete,
      update: mockUpdate,
    });

    mockSupabase = {
      from: mockFrom,
    };

    createClient.mockReturnValue(mockSupabase);

    // Mock Arbiscan API responses (empty by default)
    fetchNativeTransactions.mockResolvedValue([]);
    fetchTokenTransactions.mockResolvedValue([]);
  });

  describe('processPayouts', () => {
    const addresses = ['0x1234567890abcdef'];
    const firmId = 'test-firm';
    const nowSec = Math.floor(Date.now() / 1000);
    const inside24h = nowSec - 3600;
    const outside24h = nowSec - (25 * 3600);

    test('filters to 24h window correctly', () => {
      const nativeData = [
        { hash: '0xIn', from: '0x1234567890abcdef', to: '0xTo', value: '1000000000000000000', timeStamp: inside24h.toString() },
        { hash: '0xOut', from: '0x1234567890abcdef', to: '0xTo', value: '1000000000000000000', timeStamp: outside24h.toString() },
      ];
      const result = processPayouts(nativeData, [], addresses, firmId);
      expect(result).toHaveLength(1);
      expect(result[0].tx_hash).toBe('0xIn');
    });

    test('filters by firm addresses (only from-addresses count)', () => {
      const nativeData = [
        { hash: '0xOurs', from: '0x1234567890abcdef', to: '0xTo', value: '1000000000000000000', timeStamp: inside24h.toString() },
        { hash: '0xTheirs', from: '0xother', to: '0x1234567890abcdef', value: '1000000000000000000', timeStamp: inside24h.toString() },
      ];
      const result = processPayouts(nativeData, [], addresses, firmId);
      expect(result).toHaveLength(1);
      expect(result[0].tx_hash).toBe('0xOurs');
    });

    test('converts amounts to USD', () => {
      const nativeData = [
        { hash: '0x1', from: '0x1234567890abcdef', to: '0xTo', value: '1000000000000000000', timeStamp: inside24h.toString() },
      ];
      const result = processPayouts(nativeData, [], addresses, firmId);
      expect(result[0].amount).toBe(2500);
      expect(result[0].payment_method).toBe('crypto');
    });

    test('removes spam (<$10)', () => {
      const tokenData = [
        { hash: '0xSmall', from: '0x1234567890abcdef', to: '0xTo', value: '5000000', tokenDecimal: '6', tokenSymbol: 'USDC', timeStamp: inside24h.toString() },
      ];
      const result = processPayouts([], tokenData, addresses, firmId);
      expect(result).toHaveLength(0);
    });

    test('deduplicates by tx_hash', () => {
      const nativeData = [
        { hash: '0xDup', from: '0x1234567890abcdef', to: '0xTo', value: '1000000000000000000', timeStamp: inside24h.toString() },
      ];
      const tokenData = [
        { hash: '0xDup', from: '0x1234567890abcdef', to: '0xTo', value: '2000000000', tokenDecimal: '6', tokenSymbol: 'USDC', timeStamp: inside24h.toString() },
      ];
      const result = processPayouts(nativeData, tokenData, addresses, firmId);
      expect(result).toHaveLength(1);
    });

    test('maps tokens to payment methods', () => {
      const tokenData = [
        { hash: '0xRise', from: '0x1234567890abcdef', to: '0xTo', value: '1000000000', tokenDecimal: '6', tokenSymbol: 'RISEPAY', timeStamp: inside24h.toString() },
        { hash: '0xUsdc', from: '0x1234567890abcdef', to: '0xTo', value: '1000000000', tokenDecimal: '6', tokenSymbol: 'USDC', timeStamp: inside24h.toString() },
      ];
      const result = processPayouts([], tokenData, addresses, firmId);
      expect(result).toHaveLength(2);
      expect(result.find(p => p.tx_hash === '0xRise').payment_method).toBe('rise');
      expect(result.find(p => p.tx_hash === '0xUsdc').payment_method).toBe('crypto');
    });
  });

  describe('syncFirmPayouts', () => {
    const mockFirm = {
      id: 'test-firm',
      name: 'Test Firm',
      addresses: ['0x1234567890abcdef'],
    };

    test('should throw error if ARBISCAN_API_KEY is missing', async () => {
      delete process.env.ARBISCAN_API_KEY;

      await expect(syncFirmPayouts(mockFirm)).rejects.toThrow(
        'Missing ARBISCAN_API_KEY environment variable'
      );
    });

    test('should fetch transactions from Arbiscan for all addresses', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const firmWithMultipleAddresses = {
        ...mockFirm,
        addresses: ['0xAddress1', '0xAddress2'],
      };

      await syncFirmPayouts(firmWithMultipleAddresses);

      expect(fetchNativeTransactions).toHaveBeenCalledTimes(2);
      expect(fetchTokenTransactions).toHaveBeenCalledTimes(2);
      expect(fetchNativeTransactions).toHaveBeenCalledWith('0xAddress1', 'test-key');
      expect(fetchNativeTransactions).toHaveBeenCalledWith('0xAddress2', 'test-key');
    });

    test('should respect rate limits (delay between addresses)', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      const firmWithTwoAddresses = {
        ...mockFirm,
        addresses: ['0xA1', '0xA2'],
      };

      await syncFirmPayouts(firmWithTwoAddresses);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
      setTimeoutSpy.mockRestore();
    });

    test('should filter transactions to last 24 hours', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600; // clearly inside 24h window
      const twoDaysAgo = now - 172800;

      const mockNativeTxs = [
        {
          hash: '0xRecent',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '100000000000000000', // 0.1 ETH
          timeStamp: oneHourAgo.toString(),
        },
        {
          hash: '0xOld',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '100000000000000000',
          timeStamp: twoDaysAgo.toString(),
        },
      ];

      fetchNativeTransactions.mockResolvedValue(mockNativeTxs);

      await syncFirmPayouts(mockFirm);

      // Should only process the recent transaction
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tx_hash: '0xRecent',
          }),
        ]),
        { onConflict: 'tx_hash' }
      );

      const upsertedPayouts = mockUpsert.mock.calls[0][0];
      expect(upsertedPayouts).toHaveLength(1);
    });

    test('should filter out spam transactions (<$10)', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const now = Math.floor(Date.now() / 1000);

      const mockTokenTxs = [
        {
          hash: '0xLarge',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '1000000000', // 1000 USDC
          tokenDecimal: '6',
          tokenSymbol: 'USDC',
          timeStamp: now.toString(),
        },
        {
          hash: '0xSpam',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '5000000', // 5 USDC (spam)
          tokenDecimal: '6',
          tokenSymbol: 'USDC',
          timeStamp: now.toString(),
        },
      ];

      fetchTokenTransactions.mockResolvedValue(mockTokenTxs);

      await syncFirmPayouts(mockFirm);

      const upsertedPayouts = mockUpsert.mock.calls[0][0];
      expect(upsertedPayouts).toHaveLength(1);
      expect(upsertedPayouts[0].tx_hash).toBe('0xLarge');
    });

    test('should process USDC transactions correctly', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const now = Math.floor(Date.now() / 1000);

      const mockTokenTxs = [
        {
          hash: '0xUSDC',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '1000000000', // 1000 USDC (6 decimals)
          tokenDecimal: '6',
          tokenSymbol: 'USDC',
          timeStamp: now.toString(),
        },
      ];

      fetchTokenTransactions.mockResolvedValue(mockTokenTxs);

      await syncFirmPayouts(mockFirm);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tx_hash: '0xUSDC',
            firm_id: 'test-firm',
            amount: 1000, // 1000 USD
            payment_method: 'crypto',
          }),
        ]),
        { onConflict: 'tx_hash' }
      );
    });

    test('should process RISEPAY transactions with correct payment method', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const now = Math.floor(Date.now() / 1000);

      const mockTokenTxs = [
        {
          hash: '0xRISE',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '500000000', // 500 RISEPAY (6 decimals)
          tokenDecimal: '6',
          tokenSymbol: 'RISEPAY',
          timeStamp: now.toString(),
        },
      ];

      fetchTokenTransactions.mockResolvedValue(mockTokenTxs);

      await syncFirmPayouts(mockFirm);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            tx_hash: '0xRISE',
            payment_method: 'rise',
          }),
        ]),
        { onConflict: 'tx_hash' }
      );
    });

    test('should deduplicate transactions by tx_hash', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const now = Math.floor(Date.now() / 1000);

      // Simulate same transaction appearing in multiple queries
      const mockTx = {
        hash: '0xDuplicate',
        from: '0x1234567890abcdef',
        to: '0xRecipient',
        value: '100000000', // 100 USDC
        tokenDecimal: '6',
        tokenSymbol: 'USDC',
        timeStamp: now.toString(),
      };

      fetchTokenTransactions.mockResolvedValue([mockTx, mockTx]);

      await syncFirmPayouts(mockFirm);

      const upsertedPayouts = mockUpsert.mock.calls[0][0];
      expect(upsertedPayouts).toHaveLength(1);
    });

    test('should handle Supabase upsert errors gracefully', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const now = Math.floor(Date.now() / 1000);

      const mockTokenTxs = [
        {
          hash: '0xTx',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '1000000000',
          tokenDecimal: '6',
          tokenSymbol: 'USDC',
          timeStamp: now.toString(),
        },
      ];

      fetchTokenTransactions.mockResolvedValue(mockTokenTxs);
      mockUpsert.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await syncFirmPayouts(mockFirm);

      expect(result.error).toBe('Upsert failed: Database connection failed');
      expect(result.newPayouts).toBe(0);
    });

    test('should return success result when no new payouts', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';

      // Empty responses from Arbiscan
      fetchNativeTransactions.mockResolvedValue([]);
      fetchTokenTransactions.mockResolvedValue([]);

      const result = await syncFirmPayouts(mockFirm);

      expect(result.firmId).toBe('test-firm');
      expect(result.newPayouts).toBe(0);
      expect(result.error).toBeNull();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    test('should filter out unsupported tokens', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      const now = Math.floor(Date.now() / 1000);

      const mockTokenTxs = [
        {
          hash: '0xUSDC',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '1000000000',
          tokenDecimal: '6',
          tokenSymbol: 'USDC', // Supported
          timeStamp: now.toString(),
        },
        {
          hash: '0xDAI',
          from: '0x1234567890abcdef',
          to: '0xRecipient',
          value: '1000000000000000000',
          tokenDecimal: '18',
          tokenSymbol: 'DAI', // NOT supported
          timeStamp: now.toString(),
        },
      ];

      fetchTokenTransactions.mockResolvedValue(mockTokenTxs);

      await syncFirmPayouts(mockFirm);

      const upsertedPayouts = mockUpsert.mock.calls[0][0];
      expect(upsertedPayouts).toHaveLength(1);
      expect(upsertedPayouts[0].tx_hash).toBe('0xUSDC');
    });
  });

  describe('cleanupOldPayouts', () => {
    test('should delete payouts older than specified hours', async () => {
      const mockCount = 15;
      mockLt.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [],
          count: mockCount,
          error: null,
        }),
      });

      const result = await cleanupOldPayouts(24);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockLt).toHaveBeenCalledWith(
        'timestamp',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      );
      expect(result.deleted).toBe(mockCount);
      expect(result.error).toBeNull();
    });

    test('should handle cleanup errors gracefully', async () => {
      mockLt.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          count: 0,
          error: { message: 'Permission denied' },
        }),
      });

      const result = await cleanupOldPayouts(24);

      expect(result.deleted).toBe(0);
      expect(result.error).toBe('Permission denied');
    });

    test('should use custom hours parameter', async () => {
      const customHours = 48;
      await cleanupOldPayouts(customHours);

      // Verify cutoff calculation (48 hours ago)
      const expectedCutoff = new Date(Date.now() - customHours * 60 * 60 * 1000);
      expect(mockLt).toHaveBeenCalledWith(
        'timestamp',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      );
    });
  });

  describe('updateFirmLastPayout', () => {
    const mockFirmId = 'test-firm';
    const mockLatestPayout = {
      timestamp: new Date().toISOString(),
      amount: 1000,
      tx_hash: '0xLatest',
      payment_method: 'crypto',
    };

    test('should update firm when new payout is more recent', async () => {
      const oldTimestamp = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      mockSingle.mockResolvedValue({
        data: { last_payout_at: oldTimestamp },
        error: null,
      });

      await updateFirmLastPayout(mockFirmId, mockLatestPayout);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_payout_at: mockLatestPayout.timestamp,
          last_payout_amount: mockLatestPayout.amount,
          last_payout_tx_hash: mockLatestPayout.tx_hash,
          last_payout_method: mockLatestPayout.payment_method,
        })
      );
    });

    test('should not update firm when existing payout is newer', async () => {
      const futureTimestamp = new Date(Date.now() + 3600000).toISOString(); // 1 hour future
      mockSingle.mockResolvedValue({
        data: { last_payout_at: futureTimestamp },
        error: null,
      });

      // Reset mock to track calls
      mockUpdate.mockClear();

      await updateFirmLastPayout(mockFirmId, mockLatestPayout);

      // Should still update sync timestamp, but not payout details
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_synced_at: expect.any(String),
          updated_at: expect.any(String),
        })
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({
          last_payout_amount: expect.anything(),
        })
      );
    });

    test('should update firm when no existing payout exists', async () => {
      mockSingle.mockResolvedValue({
        data: { last_payout_at: null },
        error: null,
      });

      await updateFirmLastPayout(mockFirmId, mockLatestPayout);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_payout_at: mockLatestPayout.timestamp,
          last_payout_amount: mockLatestPayout.amount,
        })
      );
    });
  });

  describe('syncAllFirms', () => {
    test('should sync all firms from database', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';

      const mockFirms = [
        { id: 'firm1', name: 'Firm 1', addresses: ['0xAddr1'] },
        { id: 'firm2', name: 'Firm 2', addresses: ['0xAddr2'] },
      ];

      mockSelect.mockResolvedValue({ data: mockFirms, error: null });

      const result = await syncAllFirms();

      expect(mockSelect).toHaveBeenCalled();
      expect(fetchNativeTransactions).toHaveBeenCalledTimes(2);
      expect(result.firms).toBe(2);
      expect(result.totalPayouts).toBe(0);
      expect(result.errors).toEqual([]);
    });

    test('should handle firms fetch error', async () => {
      mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      });

      await expect(syncAllFirms()).rejects.toThrow('Failed to fetch firms: Connection failed');
    });

    test('should return empty result when no firms exist', async () => {
      mockSelect.mockResolvedValue({ data: [], error: null });

      const result = await syncAllFirms();

      expect(result.firms).toBe(0);
      expect(result.totalPayouts).toBe(0);
      expect(result.errors).toEqual([]);
    });

    test('should collect errors from failed firm syncs', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';

      const mockFirms = [
        { id: 'firm1', name: 'Firm 1', addresses: ['0xAddr1'] },
      ];

      mockSelect.mockResolvedValue({ data: mockFirms, error: null });
      fetchNativeTransactions.mockRejectedValue(new Error('API timeout'));

      const result = await syncAllFirms();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].firmId).toBe('firm1');
      expect(result.errors[0].error).toContain('API timeout');
    });

    test('should cleanup old payouts after sync', async () => {
      process.env.ARBISCAN_API_KEY = 'test-key';
      // Need at least one firm so sync runs and reaches cleanupOldPayouts(24)
      mockSelect.mockResolvedValue({
        data: [{ id: 'firm1', name: 'Firm 1', addresses: ['0xAddr1'] }],
        error: null,
      });

      await syncAllFirms();

      expect(mockDelete).toHaveBeenCalled();
    });
  });
});
