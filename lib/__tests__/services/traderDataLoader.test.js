/**
 * Trader Data Loader Tests
 * S7-006: Unit tests for traderDataLoader.js
 * Covers: loadTraderMonthlyData, getTraderAvailableMonths, getAllTraderTransactions, loadTraderPeriodData
 */

import fs from 'fs';
import path from 'path';
import {
  loadTraderMonthlyData,
  getTraderAvailableMonths,
  getAllTraderTransactions,
  loadTraderPeriodData,
} from '@/lib/services/traderDataLoader';

jest.mock('fs');

describe('Trader Data Loader', () => {
  let mockSupabase;
  let mockFrom;
  let mockSelect;
  let mockEq;
  let mockOrder;
  let mockMaybeSingle;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    mockOrder = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockEq = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ order: mockOrder }) });
    mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
    mockSupabase = { from: mockFrom };
    fs.existsSync = jest.fn().mockReturnValue(false);
    fs.readFileSync = jest.fn();
    fs.readdirSync = jest.fn().mockReturnValue([]);
  });

  describe('loadTraderMonthlyData', () => {
    it('returns blob from Supabase when client provided and row exists', async () => {
      const blob = { summary: { totalPayouts: 100 }, transactions: [{ tx_hash: '0xa', amount: 100 }] };
      mockEq.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { data: blob }, error: null }),
        }),
      });

      const result = await loadTraderMonthlyData('0xabc', '2025-01', mockSupabase);

      expect(mockFrom).toHaveBeenCalledWith('trader_history_payouts');
      expect(result).toEqual(blob);
    });

    it('returns null when Supabase returns error', async () => {
      mockEq.mockReturnValueOnce({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      });

      const result = await loadTraderMonthlyData('0xabc', '2025-01', mockSupabase);

      expect(result).toBeNull();
    });

    it('reads from fs when no supabase and file exists', async () => {
      const walletLower = '0xabc';
      const yearMonth = '2025-01';
      const filePath = path.join(process.cwd(), 'data', 'traders', walletLower, `${yearMonth}.json`);
      const blob = { summary: {}, transactions: [{ tx_hash: '0xb', amount: 50, timestamp: '2025-01-15T00:00:00Z' }] };
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(blob));

      const result = await loadTraderMonthlyData('0xAbC', yearMonth, null);

      expect(fs.existsSync).toHaveBeenCalledWith(filePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(filePath, 'utf8');
      expect(result).toEqual(blob);
    });

    it('returns null when no supabase and file does not exist', async () => {
      const result = await loadTraderMonthlyData('0xabc', '2025-01', null);
      expect(result).toBeNull();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });

  describe('getTraderAvailableMonths', () => {
    it('returns months from Supabase when client provided', async () => {
      const chain = { eq: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [{ year_month: '2025-02' }, { year_month: '2025-01' }], error: null }) }) };
      mockFrom.mockReturnValueOnce({ select: jest.fn().mockReturnValue(chain) });

      const result = await getTraderAvailableMonths('0xabc', mockSupabase);

      expect(result).toEqual(['2025-02', '2025-01']);
    });

    it('returns empty array when Supabase has no data', async () => {
      const chain = { eq: jest.fn().mockReturnValue({ order: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      mockFrom.mockReturnValueOnce({ select: jest.fn().mockReturnValue(chain) });

      const result = await getTraderAvailableMonths('0xabc', mockSupabase);

      expect(result).toEqual([]);
    });

    it('returns months from fs when no supabase and dir exists', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['2025-01.json', '2024-12.json']);

      const result = await getTraderAvailableMonths('0xabc', null);

      expect(result).toEqual(['2025-01', '2024-12']);
    });

    it('returns empty array when no supabase and dir does not exist', async () => {
      const result = await getTraderAvailableMonths('0xabc', null);
      expect(result).toEqual([]);
    });
  });

  describe('getAllTraderTransactions', () => {
    it('returns empty array when no months available', async () => {
      const orderPromise = Promise.resolve({ data: [], error: null });
      const chain = {
        eq: jest.fn().mockReturnValue({ order: jest.fn().mockReturnValue(orderPromise) }),
      };
      mockFrom.mockReturnValue({ select: jest.fn().mockReturnValue(chain) });

      const result = await getAllTraderTransactions('0xabc', null, mockSupabase);

      expect(result).toEqual([]);
    });

    it('returns and sorts transactions from multiple months (newest first)', async () => {
      const janBlob = { transactions: [{ tx_hash: '0x1', amount: 10, timestamp: '2025-01-15T00:00:00Z' }] };
      const febBlob = { transactions: [{ tx_hash: '0x2', amount: 20, timestamp: '2025-02-20T00:00:00Z' }] };
      let dataCallCount = 0;
      mockFrom.mockImplementation((table) => {
        if (table !== 'trader_history_payouts') return {};
        return {
          select: jest.fn().mockImplementation((col) => {
            if (col === 'year_month') {
              return {
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({
                    data: [{ year_month: '2025-02' }, { year_month: '2025-01' }],
                    error: null,
                  }),
                }),
              };
            }
            return {
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockImplementation(() => {
                    const count = dataCallCount++;
                    return Promise.resolve({
                      data: { data: count === 0 ? febBlob : janBlob },
                      error: null,
                    });
                  }),
                }),
              }),
            };
          }),
        };
      });

      const result = await getAllTraderTransactions('0xabc', null, mockSupabase);

      expect(result).toHaveLength(2);
      expect(result[0].tx_hash).toBe('0x2');
      expect(result[1].tx_hash).toBe('0x1');
    });

    it('applies limit when provided', async () => {
      const blob = {
        transactions: [
          { tx_hash: '0xa', amount: 1, timestamp: '2025-01-02T00:00:00Z' },
          { tx_hash: '0xb', amount: 2, timestamp: '2025-01-01T00:00:00Z' },
        ],
      };
      mockFrom.mockImplementation((table) => {
        if (table !== 'trader_history_payouts') return {};
        return {
          select: jest.fn().mockImplementation((col) => {
            if (col === 'year_month') {
              return {
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: [{ year_month: '2025-01' }], error: null }),
                }),
              };
            }
            return {
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: { data: blob }, error: null }),
                }),
              }),
            };
          }),
        };
      });

      const result = await getAllTraderTransactions('0xabc', 1, mockSupabase);

      expect(result).toHaveLength(1);
      expect(result[0].tx_hash).toBe('0xa');
    });
  });

  describe('loadTraderPeriodData', () => {
    it('returns empty structure for unknown period', async () => {
      const result = await loadTraderPeriodData('0xabc', '7d', null);
      expect(result).toEqual({ summary: {}, dailyBuckets: [], monthlyBuckets: [], transactions: [] });
    });

    it('30d: filters transactions and buckets by 30-day cutoff', async () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const inside = new Date(cutoff.getTime() + 86400000).toISOString();
      const outside = new Date(cutoff.getTime() - 86400000).toISOString();

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([`${currentMonth}.json`, `${prevMonth}.json`]);
      fs.readFileSync.mockImplementation((p) => {
        if (String(p).includes(currentMonth)) {
          return JSON.stringify({
            dailyBuckets: [{ date: now.toISOString().split('T')[0], total: 100 }],
            transactions: [{ tx_hash: '0xin', amount: 100, timestamp: inside }],
          });
        }
        if (String(p).includes(prevMonth)) {
          return JSON.stringify({
            dailyBuckets: [{ date: cutoff.toISOString().split('T')[0], total: 50 }],
            transactions: [{ tx_hash: '0xout', amount: 50, timestamp: outside }],
          });
        }
        return '{}';
      });

      const result = await loadTraderPeriodData('0xabc', '30d', null);

      expect(result.summary.payoutCount).toBe(1);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].tx_hash).toBe('0xin');
    });

    it('12m: returns monthlyBuckets and summary', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const yearMonth = `${year}-${month}`;

      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([`${yearMonth}.json`]);
      fs.readFileSync.mockImplementation((filePath) => {
        if (String(filePath).includes(yearMonth)) {
          return JSON.stringify({
            summary: { totalPayouts: 500, payoutCount: 2, largestPayout: 300 },
          });
        }
        return JSON.stringify({ summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 } });
      });

      const result = await loadTraderPeriodData('0xabc', '12m', null);

      expect(result.summary.totalPayouts).toBeGreaterThanOrEqual(500);
      expect(result.summary.payoutCount).toBeGreaterThanOrEqual(2);
      expect(result.monthlyBuckets).toBeDefined();
      expect(Array.isArray(result.monthlyBuckets)).toBe(true);
      expect(result.monthlyBuckets.length).toBe(12);
    });
  });
});
