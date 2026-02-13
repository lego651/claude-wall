/**
 * PROP-008: Unit tests for payout data loader
 */

import path from 'path';
import {
  loadMonthlyData,
  getAvailableMonths,
  loadPeriodData,
  getTopPayoutsFromFiles,
} from '@/lib/services/payoutDataLoader';

const PAYOUTS_BASE = path.join(process.cwd(), 'data', 'payouts');

const mockFileContent = new Map();
const mockDirContents = new Map();

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  const pathMod = require('path');
  return {
    ...actual,
    existsSync(p) {
      if (mockFileContent.has(p)) return true;
      if (mockDirContents.has(p)) return true;
      const dir = pathMod.dirname(p);
      return mockDirContents.has(dir);
    },
    readFileSync(p, enc) {
      if (mockFileContent.has(p)) return mockFileContent.get(p);
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    },
    statSync(p) {
      const content = mockFileContent.get(p) || '';
      return { size: Buffer.byteLength(content, 'utf8') };
    },
    readdirSync(p) {
      return mockDirContents.get(p) || [];
    },
    promises: {
      access(p) {
        const exists =
          mockFileContent.has(p) ||
          mockDirContents.has(p) ||
          mockDirContents.has(pathMod.dirname(p));
        return exists
          ? Promise.resolve()
          : Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      },
      stat(p) {
        const content = mockFileContent.get(p) || '';
        return Promise.resolve({ size: Buffer.byteLength(content, 'utf8') });
      },
      readFile(p, enc) {
        if (mockFileContent.has(p)) return Promise.resolve(mockFileContent.get(p));
        return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      },
    },
  };
});

jest.mock('@/lib/logger', () => {
  const warn = jest.fn();
  const error = jest.fn();
  return {
    createLogger: () => ({ warn, error, info: jest.fn(), debug: jest.fn() }),
    __getLoggerMocks: () => ({ warn, error }),
  };
});

jest.mock('@/lib/cache', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('payoutDataLoader', () => {
  beforeEach(() => {
    mockFileContent.clear();
    mockDirContents.clear();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('loadMonthlyData', () => {
    it('loads existing file successfully', async () => {
      const firmId = 'firm1';
      const yearMonth = '2025-01';
      const filePath = path.join(PAYOUTS_BASE, firmId, `${yearMonth}.json`);
      const data = { summary: { totalPayouts: 1000 }, dailyBuckets: [], transactions: [] };
      mockFileContent.set(filePath, JSON.stringify(data));

      const result = await loadMonthlyData(firmId, yearMonth);
      expect(result).toEqual(data);
    });

    it('returns null for missing file', async () => {
      const result = await loadMonthlyData('nofirm', '2025-01');
      expect(result).toBeNull();
    });

    it('returns null for missing directory (existsSync false)', async () => {
      mockDirContents.clear();
      mockFileContent.clear();
      const result = await loadMonthlyData('nodir', '2025-01');
      expect(result).toBeNull();
    });

    it('handles corrupted JSON gracefully', async () => {
      const filePath = path.join(PAYOUTS_BASE, 'firm1', '2025-01.json');
      mockFileContent.set(filePath, 'not valid json {');

      const result = await loadMonthlyData('firm1', '2025-01');
      expect(result).toBeNull();
    });

    it('logs error when file read fails', async () => {
      const filePath = path.join(PAYOUTS_BASE, 'firm1', '2025-01.json');
      mockFileContent.set(filePath, '{}');
      const fs = require('fs');
      jest.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(new Error('EACCES'));

      const result = await loadMonthlyData('firm1', '2025-01');
      expect(result).toBeNull();
    });

    it('logs warning when file size exceeds 500KB', async () => {
      const filePath = path.join(PAYOUTS_BASE, 'firm1', '2025-01.json');
      const small = JSON.stringify({ summary: {}, dailyBuckets: [], transactions: [] });
      const bigContent = small + 'x'.repeat(500 * 1024 - small.length + 1);
      mockFileContent.set(filePath, bigContent);

      await loadMonthlyData('firm1', '2025-01');
      const { __getLoggerMocks } = require('@/lib/logger');
      expect(__getLoggerMocks().warn).toHaveBeenCalledWith(
        expect.objectContaining({
          firmId: 'firm1',
          yearMonth: '2025-01',
        }),
        'Loading large payout file (>500KB)'
      );
    });
  });

  describe('getAvailableMonths', () => {
    it('returns sorted months (newest first)', () => {
      const firmDir = path.join(PAYOUTS_BASE, 'firm1');
      mockDirContents.set(firmDir, ['2025-01.json', '2025-03.json', '2025-02.json']);

      const result = getAvailableMonths('firm1');
      expect(result).toEqual(['2025-03', '2025-02', '2025-01']);
    });

    it('filters non-JSON files', () => {
      const firmDir = path.join(PAYOUTS_BASE, 'firm1');
      mockDirContents.set(firmDir, ['2025-01.json', 'readme.txt', '2025-02.json', '.DS_Store']);

      const result = getAvailableMonths('firm1');
      expect(result).toEqual(['2025-02', '2025-01']);
    });

    it('returns empty array for missing dir', () => {
      mockDirContents.clear();
      const result = getAvailableMonths('nodir');
      expect(result).toEqual([]);
    });

    it('returns empty array when readdirSync throws', () => {
      const firmDir = path.join(PAYOUTS_BASE, 'firm1');
      mockDirContents.set(firmDir, []);
      const fs = require('fs');
      jest.spyOn(fs, 'readdirSync').mockImplementationOnce(() => {
        throw new Error('EACCES');
      });

      const result = getAvailableMonths('firm1');
      expect(result).toEqual([]);
    });
  });

  describe('loadPeriodData', () => {
    const month = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

    it('filters to last 7 days correctly', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));
      const currentMonth = '2025-02';
      const prevMonth = '2025-01';
      const currentPath = path.join(PAYOUTS_BASE, 'firm1', `${currentMonth}.json`);
      const prevPath = path.join(PAYOUTS_BASE, 'firm1', `${prevMonth}.json`);
      // Cutoff for 7d is 2025-02-08; only transactions on or after that count
      mockFileContent.set(currentPath, JSON.stringify({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: [
          { date: '2025-02-10', total: 100 },
          { date: '2025-02-11', total: 50 },
        ],
        transactions: [
          { tx_hash: 'a', timestamp: '2025-02-10T00:00:00.000Z', amount: 100, payment_method: 'rise' },
          { tx_hash: 'b', timestamp: '2025-02-11T00:00:00.000Z', amount: 50, payment_method: 'crypto' },
        ],
      }));
      mockFileContent.set(prevPath, JSON.stringify({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: [],
        transactions: [],
      }));

      const result = await loadPeriodData('firm1', '7d');
      expect(result.summary.payoutCount).toBe(2);
      expect(result.summary.totalPayouts).toBe(150);
      expect(result.summary.largestPayout).toBe(100);
      expect(result.dailyBuckets.map(b => b.date)).toContain('2025-02-10');
      expect(result.dailyBuckets.map(b => b.date).every(d => d >= '2025-02-08')).toBe(true);
      jest.useRealTimers();
    });

    it('filters to last 30 days correctly', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));
      const currentMonth = '2025-02';
      const prevMonth = '2025-01';
      const currentPath = path.join(PAYOUTS_BASE, 'firm1', `${currentMonth}.json`);
      const prevPath = path.join(PAYOUTS_BASE, 'firm1', `${prevMonth}.json`);

      mockFileContent.set(currentPath, JSON.stringify({
        summary: { totalPayouts: 500, payoutCount: 2, largestPayout: 300 },
        dailyBuckets: [{ date: '2025-02-10', total: 500 }],
        transactions: [
          { tx_hash: 'a', timestamp: '2025-02-10T00:00:00.000Z', amount: 300, payment_method: 'rise' },
          { tx_hash: 'b', timestamp: '2025-02-12T00:00:00.000Z', amount: 200, payment_method: 'crypto' },
        ],
      }));
      mockFileContent.set(prevPath, JSON.stringify({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: [],
        transactions: [],
      }));

      const result = await loadPeriodData('firm1', '30d');
      expect(result.summary.payoutCount).toBe(2);
      expect(result.summary.totalPayouts).toBe(500);
      expect(result.summary.largestPayout).toBe(300);
      expect(result.summary.avgPayout).toBe(250);
      jest.useRealTimers();
    });

    it('aggregates 12 months correctly', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-03-01T00:00:00.000Z'));
      const firmDir = path.join(PAYOUTS_BASE, 'firm1');
      mockDirContents.set(firmDir, [
        '2024-04.json', '2024-05.json', '2024-06.json', '2024-07.json', '2024-08.json', '2024-09.json',
        '2024-10.json', '2024-11.json', '2024-12.json', '2025-01.json', '2025-02.json', '2025-03.json',
      ]);

      const monthly = (total, count, largest) => ({
        summary: { totalPayouts: total, payoutCount: count, largestPayout: largest },
        dailyBuckets: [{ date: '2025-01-01', rise: 0, crypto: 0, wire: 0 }],
        transactions: [],
      });
      mockFileContent.set(path.join(PAYOUTS_BASE, 'firm1', '2024-04.json'), JSON.stringify(monthly(1000, 1, 1000)));
      mockFileContent.set(path.join(PAYOUTS_BASE, 'firm1', '2024-05.json'), JSON.stringify(monthly(2000, 2, 1500)));
      for (const m of ['2024-06', '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12', '2025-01', '2025-02', '2025-03']) {
        mockFileContent.set(path.join(PAYOUTS_BASE, 'firm1', `${m}.json`), JSON.stringify(monthly(0, 0, 0)));
      }

      const result = await loadPeriodData('firm1', '12m');
      expect(result.summary.totalPayouts).toBe(3000);
      expect(result.summary.payoutCount).toBe(3);
      expect(result.summary.largestPayout).toBe(1500);
      expect(result.monthlyBuckets.length).toBe(12);
      expect(result.monthlyBuckets[0].month).toMatch(/\w+ \d{4}/);
      expect(result.monthlyBuckets.some(b => b.month.includes('2024'))).toBe(true);
      jest.useRealTimers();
    });

    it('calculates summary metrics accurately', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-01T12:00:00.000Z'));
      const currentPath = path.join(PAYOUTS_BASE, 'firm1', '2025-02.json');
      const prevPath = path.join(PAYOUTS_BASE, 'firm1', '2025-01.json');
      mockFileContent.set(currentPath, JSON.stringify({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: [],
        transactions: [
          { tx_hash: 'a', timestamp: '2025-01-20T00:00:00.000Z', amount: 1000, payment_method: 'rise' },
          { tx_hash: 'b', timestamp: '2025-01-21T00:00:00.000Z', amount: 2000, payment_method: 'crypto' },
        ],
      }));
      mockFileContent.set(prevPath, JSON.stringify({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: [],
        transactions: [],
      }));

      const result = await loadPeriodData('firm1', '30d');
      expect(result.summary.payoutCount).toBe(2);
      expect(result.summary.totalPayouts).toBe(3000);
      expect(result.summary.largestPayout).toBe(2000);
      expect(result.summary.avgPayout).toBe(1500);
      jest.useRealTimers();
    });

    it('handles missing files gracefully', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));
      mockFileContent.clear();

      const result = await loadPeriodData('firm1', '7d');
      expect(result.summary.payoutCount).toBe(0);
      expect(result.summary.totalPayouts).toBe(0);
      expect(result.dailyBuckets).toEqual([]);
      jest.useRealTimers();
    });

    it('merges data from multiple months for 30d', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-05T12:00:00.000Z'));
      const currentPath = path.join(PAYOUTS_BASE, 'firm1', '2025-02.json');
      const prevPath = path.join(PAYOUTS_BASE, 'firm1', '2025-01.json');
      mockFileContent.set(prevPath, JSON.stringify({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: [{ date: '2025-01-30', total: 100 }],
        transactions: [{ tx_hash: 'x', timestamp: '2025-01-30T00:00:00.000Z', amount: 100, payment_method: 'rise' }],
      }));
      mockFileContent.set(currentPath, JSON.stringify({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
        dailyBuckets: [{ date: '2025-02-01', total: 200 }],
        transactions: [{ tx_hash: 'y', timestamp: '2025-02-01T00:00:00.000Z', amount: 200, payment_method: 'crypto' }],
      }));

      const result = await loadPeriodData('firm1', '30d');
      expect(result.summary.payoutCount).toBe(2);
      expect(result.summary.totalPayouts).toBe(300);
      expect(result.dailyBuckets.length).toBeGreaterThanOrEqual(1);
      jest.useRealTimers();
    });

    it('returns empty summary for unknown period', async () => {
      const result = await loadPeriodData('firm1', '90d');
      expect(result).toEqual({ summary: {}, dailyBuckets: [], monthlyBuckets: [] });
    });
  });

  describe('getTopPayoutsFromFiles', () => {
    it('returns top N payouts sorted by amount', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));
      const currentPath = path.join(PAYOUTS_BASE, 'firm1', '2025-02.json');
      const prevPath = path.join(PAYOUTS_BASE, 'firm1', '2025-01.json');
      const tx = (hash, amount, ts) => ({ tx_hash: hash, timestamp: ts, amount, payment_method: 'crypto' });
      mockFileContent.set(currentPath, JSON.stringify({
        summary: {}, dailyBuckets: [],
        transactions: [
          tx('0xa', 5000, '2025-02-10T00:00:00.000Z'),
          tx('0xb', 10000, '2025-02-11T00:00:00.000Z'),
          tx('0xc', 3000, '2025-02-12T00:00:00.000Z'),
        ],
      }));
      mockFileContent.set(prevPath, JSON.stringify({ summary: {}, dailyBuckets: [], transactions: [] }));

      const result = await getTopPayoutsFromFiles('firm1', '30d', 2);
      expect(result.length).toBe(2);
      expect(result[0].amount).toBe(10000);
      expect(result[0].id).toBe('0xb');
      expect(result[1].amount).toBe(5000);
      expect(result[0].arbiscanUrl).toBe('https://arbiscan.io/tx/0xb');
      expect(result[0].date).toBe('2025-02-11');
      jest.useRealTimers();
    });

    it('filters by period 30d', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));
      const prevPath = path.join(PAYOUTS_BASE, 'firm1', '2025-01.json');
      mockFileContent.set(prevPath, JSON.stringify({
        summary: {}, dailyBuckets: [],
        transactions: [{ tx_hash: '0xold', timestamp: '2024-12-01T00:00:00.000Z', amount: 999, payment_method: 'rise' }],
      }));
      mockFileContent.set(path.join(PAYOUTS_BASE, 'firm1', '2025-02.json'), JSON.stringify({
        summary: {}, dailyBuckets: [],
        transactions: [{ tx_hash: '0xnew', timestamp: '2025-02-01T00:00:00.000Z', amount: 100, payment_method: 'crypto' }],
      }));

      const result = await getTopPayoutsFromFiles('firm1', '30d', 10);
      expect(result.length).toBe(1);
      expect(result[0].amount).toBe(100);
      jest.useRealTimers();
    });

    it('filters by period 12m', async () => {
      const firmDir = path.join(PAYOUTS_BASE, 'firm1');
      mockDirContents.set(firmDir, ['2025-01.json']);
      mockFileContent.set(path.join(PAYOUTS_BASE, 'firm1', '2025-01.json'), JSON.stringify({
        summary: {}, dailyBuckets: [],
        transactions: [
          { tx_hash: '0x1', timestamp: '2025-01-10T00:00:00.000Z', amount: 5000, payment_method: 'wire' },
          { tx_hash: '0x2', timestamp: '2025-01-11T00:00:00.000Z', amount: 3000, payment_method: 'rise' },
        ],
      }));

      const result = await getTopPayoutsFromFiles('firm1', '12m', 5);
      expect(result.length).toBe(2);
      expect(result[0].amount).toBe(5000);
      expect(result[1].amount).toBe(3000);
    });

    it('handles empty data', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));
      mockFileContent.clear();

      expect(await getTopPayoutsFromFiles('firm1', '30d', 10)).toEqual([]);
      expect(await getTopPayoutsFromFiles('firm1', '99d')).toEqual([]);
      jest.useRealTimers();
    });
  });
});
