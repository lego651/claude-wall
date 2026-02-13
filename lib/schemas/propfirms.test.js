/**
 * PROP-017: Unit tests for propfirms Zod schemas
 */

import {
  FirmIdSchema,
  MetricsSchema,
  FirmSchema,
  PropfirmsListResponseSchema,
  PayoutSchema,
  LatestPayoutsResponseSchema,
  TopPayoutsResponseSchema,
  ChartDataSchema,
  parseOrLog,
  validatePropfirmsListResponse,
  validateLatestPayoutsResponse,
  validateTopPayoutsResponse,
  validateChartResponse,
} from '@/lib/schemas/propfirms';

describe('lib/schemas/propfirms', () => {
  describe('FirmIdSchema', () => {
    it('accepts alphanumeric and hyphens', () => {
      expect(FirmIdSchema.parse('ftmo')).toBe('ftmo');
      expect(FirmIdSchema.parse('funding-pips')).toBe('funding-pips');
      expect(FirmIdSchema.parse('firm_1')).toBe('firm_1');
    });
    it('rejects empty or invalid', () => {
      expect(() => FirmIdSchema.parse('')).toThrow();
      expect(() => FirmIdSchema.parse('a b')).toThrow();
      expect(() => FirmIdSchema.parse('a@b')).toThrow();
    });
  });

  describe('MetricsSchema', () => {
    it('accepts valid metrics', () => {
      const m = {
        totalPayouts: 1000,
        payoutCount: 5,
        largestPayout: 500,
        avgPayout: 200,
        latestPayoutAt: '2025-01-15T00:00:00.000Z',
      };
      expect(MetricsSchema.parse(m)).toEqual(m);
    });
    it('accepts null latestPayoutAt', () => {
      const m = { totalPayouts: 0, payoutCount: 0, largestPayout: 0, avgPayout: 0, latestPayoutAt: null };
      expect(MetricsSchema.parse(m)).toEqual(m);
    });
    it('rejects negative numbers', () => {
      expect(() => MetricsSchema.parse({ totalPayouts: -1, payoutCount: 0, largestPayout: 0, avgPayout: 0 })).toThrow();
    });
  });

  describe('FirmSchema', () => {
    it('accepts valid firm', () => {
      const firm = {
        id: 'ftmo',
        name: 'FTMO',
        logo: null,
        website: 'https://ftmo.com',
        metrics: { totalPayouts: 100, payoutCount: 2, largestPayout: 60, avgPayout: 50 },
      };
      expect(FirmSchema.parse(firm)).toEqual(firm);
    });
    it('rejects missing required fields', () => {
      expect(() => FirmSchema.parse({ id: 'x', name: 'X' })).toThrow(); // missing metrics
      expect(() => FirmSchema.parse({ name: 'X', metrics: {} })).toThrow(); // missing id
    });
  });

  describe('PropfirmsListResponseSchema', () => {
    it('accepts valid list response', () => {
      const body = {
        data: [
          {
            id: 'ftmo',
            name: 'FTMO',
            logo: null,
            website: null,
            metrics: { totalPayouts: 0, payoutCount: 0, largestPayout: 0, avgPayout: 0 },
          },
        ],
        meta: { period: '7d', sort: 'totalPayouts', order: 'desc', count: 1 },
      };
      expect(PropfirmsListResponseSchema.parse(body)).toEqual(body);
    });
    it('rejects invalid meta', () => {
      const body = {
        data: [],
        meta: { period: '7d', sort: 'x', order: 'desc', count: -1 },
      };
      expect(() => PropfirmsListResponseSchema.parse(body)).toThrow();
    });
  });

  describe('PayoutSchema', () => {
    it('accepts valid payout', () => {
      const p = {
        id: '0xabc',
        timestamp: '2025-01-15T12:00:00Z',
        amount: 1500,
        paymentMethod: 'rise',
        txHash: '0xabc',
        arbiscanUrl: 'https://arbiscan.io/tx/0xabc',
      };
      expect(PayoutSchema.parse(p)).toEqual(p);
    });
  });

  describe('LatestPayoutsResponseSchema', () => {
    it('accepts valid response', () => {
      const body = {
        firmId: 'ftmo',
        payouts: [
          { id: '0x1', timestamp: '2025-01-15T00:00:00Z', amount: 100, paymentMethod: 'rise', txHash: '0x1' },
        ],
        count: 1,
      };
      expect(LatestPayoutsResponseSchema.parse(body)).toEqual(body);
    });
  });

  describe('TopPayoutsResponseSchema', () => {
    it('accepts valid response', () => {
      const body = {
        firmId: 'ftmo',
        period: '30d',
        payouts: [
          { id: '0x1', timestamp: '2025-01-15T00:00:00Z', amount: 5000, paymentMethod: 'rise', txHash: '0x1' },
        ],
      };
      expect(TopPayoutsResponseSchema.parse(body)).toEqual(body);
    });
  });

  describe('ChartDataSchema', () => {
    it('accepts valid chart response', () => {
      const body = {
        firm: { id: 'ftmo', name: 'FTMO', logo: null, website: null },
        summary: { totalPayouts: 1000, payoutCount: 10, largestPayout: 200, avgPayout: 100 },
        chart: {
          period: '30d',
          bucketType: 'daily',
          data: [{ date: '2025-01-15', total: 100, rise: 50, crypto: 50, wire: 0 }],
        },
      };
      expect(ChartDataSchema.parse(body)).toEqual(body);
    });
    it('accepts monthly bucketType', () => {
      const body = {
        firm: { id: 'ftmo', name: 'FTMO' },
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0, avgPayout: 0 },
        chart: { period: '12m', bucketType: 'monthly', data: [{ month: 'Jan 2025', total: 0 }] },
      };
      expect(ChartDataSchema.parse(body)).toEqual(body);
    });
  });

  describe('parseOrLog', () => {
    it('returns success and data when valid', () => {
      const out = parseOrLog(FirmIdSchema, 'ftmo', 'test');
      expect(out.success).toBe(true);
      expect(out.data).toBe('ftmo');
    });
    it('returns success false and null when invalid', () => {
      const out = parseOrLog(FirmIdSchema, 'invalid id!', 'test');
      expect(out.success).toBe(false);
      expect(out.data).toBeNull();
    });
  });

  describe('validatePropfirmsListResponse', () => {
    it('returns data when valid', () => {
      const body = {
        data: [{ id: 'ftmo', name: 'FTMO', metrics: { totalPayouts: 0, payoutCount: 0, largestPayout: 0, avgPayout: 0 } }],
        meta: { period: '7d', sort: 'totalPayouts', order: 'desc', count: 1 },
      };
      const validated = validatePropfirmsListResponse(body);
      expect(validated).not.toBeNull();
      expect(validated.data).toHaveLength(1);
      expect(validated.meta.count).toBe(1);
    });
    it('returns null when invalid', () => {
      expect(validatePropfirmsListResponse({ data: [], meta: { count: -1 } })).toBeNull();
      expect(validatePropfirmsListResponse(null)).toBeNull();
    });
  });

  describe('validateLatestPayoutsResponse', () => {
    it('returns data when valid', () => {
      const body = { firmId: 'ftmo', payouts: [], count: 0 };
      expect(validateLatestPayoutsResponse(body)).not.toBeNull();
    });
    it('returns null when invalid', () => {
      expect(validateLatestPayoutsResponse({ firmId: '', payouts: [], count: 0 })).toBeNull();
    });
  });

  describe('validateTopPayoutsResponse', () => {
    it('returns data when valid', () => {
      const body = { firmId: 'ftmo', period: '30d', payouts: [] };
      expect(validateTopPayoutsResponse(body)).not.toBeNull();
    });
  });

  describe('validateChartResponse', () => {
    it('returns data when valid', () => {
      const body = {
        firm: { id: 'ftmo', name: 'FTMO' },
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0, avgPayout: 0 },
        chart: { period: '30d', bucketType: 'daily', data: [] },
      };
      expect(validateChartResponse(body)).not.toBeNull();
    });
    it('returns null when invalid', () => {
      expect(validateChartResponse({ firm: {}, summary: {}, chart: {} })).toBeNull();
    });
  });
});
