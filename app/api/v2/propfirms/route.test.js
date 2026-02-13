/**
 * PROP-011: Integration tests for GET /api/v2/propfirms
 */

import { GET } from './route';
import { createClient } from '@supabase/supabase-js';
import { loadPeriodData } from '@/lib/services/payoutDataLoader';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/services/payoutDataLoader');
jest.mock('@/lib/apiSecurity');
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
}));
jest.mock('@/middleware/requestId', () => ({
  getRequestId: () => 'test-req-id',
  setRequestIdHeader: jest.fn(),
}));
const fs = require('fs');
jest.mock('fs');

function createRequest(url = 'https://example.com/api/v2/propfirms', headers = {}) {
  const origin = headers.Origin ?? headers.origin ?? 'http://localhost:3000';
  return new Request(url, {
    headers: { Origin: origin, ...headers },
  });
}

describe('GET /api/v2/propfirms', () => {
  let mockFrom;
  let mockSelectFirms;
  let mockSelectPayouts;
  let mockIn;
  let mockGte;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    validateOrigin.mockReturnValue({ ok: true, headers: {} });
    isRateLimited.mockReturnValue({ limited: false, retryAfterMs: 60_000 });

    mockGte = jest.fn().mockResolvedValue({ data: [], error: null });
    mockIn = jest.fn().mockReturnValue({ gte: mockGte });
    mockSelectPayouts = jest.fn().mockReturnValue({ in: mockIn });
    mockSelectFirms = jest.fn().mockResolvedValue({
      data: [
        { id: 'firm1', name: 'Firm One', logo_url: null, website: null, last_payout_at: null },
      ],
      error: null,
    });
    mockFrom = jest.fn().mockImplementation((table) => {
      if (table === 'firms') return { select: mockSelectFirms };
      if (table === 'recent_payouts') return { select: mockSelectPayouts };
      return {};
    });
    createClient.mockReturnValue({ from: mockFrom });
  });

  describe('successful responses', () => {
    it('returns 200 for 1d period (Supabase)', async () => {
      mockSelectFirms.mockResolvedValueOnce({
        data: [{ id: 'f1', name: 'F1', logo_url: null, website: null, last_payout_at: null }],
        error: null,
      });
      mockGte.mockResolvedValueOnce({
        data: [{ firm_id: 'f1', amount: 1000 }],
        error: null,
      });

      const req = createRequest('https://x.com/api/v2/propfirms?period=1d');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].metrics.totalPayouts).toBe(1000);
      expect(body.meta.period).toBe('1d');
    });

    it('returns 200 for 7d period (JSON/loadPeriodData)', async () => {
      loadPeriodData.mockReturnValue({
        summary: { totalPayouts: 5000, payoutCount: 10, largestPayout: 1000, avgPayout: 500 },
      });

      const req = createRequest('https://x.com/api/v2/propfirms?period=7d');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(loadPeriodData).toHaveBeenCalledWith('firm1', '7d');
      expect(body.data[0].metrics.totalPayouts).toBe(5000);
      expect(body.meta.period).toBe('7d');
    });

    it('returns 200 for 30d and 12m periods', async () => {
      loadPeriodData.mockReturnValue({
        summary: { totalPayouts: 10000, payoutCount: 20, largestPayout: 2000, avgPayout: 500 },
      });

      for (const period of ['30d', '12m']) {
        const req = createRequest(`https://x.com/api/v2/propfirms?period=${period}`);
        const res = await GET(req);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.meta.period).toBe(period);
      }
    });

    it('returns correct data structure', async () => {
      const req = createRequest('https://x.com/api/v2/propfirms');
      const res = await GET(req);
      const body = await res.json();

      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toMatchObject({
        period: expect.any(String),
        sort: expect.any(String),
        order: expect.any(String),
        count: expect.any(Number),
      });
      expect(Array.isArray(body.data)).toBe(true);
      if (body.data.length > 0) {
        expect(body.data[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          metrics: expect.objectContaining({
            totalPayouts: expect.any(Number),
            payoutCount: expect.any(Number),
            largestPayout: expect.any(Number),
            avgPayout: expect.any(Number),
          }),
        });
      }
    });

    it('returns sorted data (desc)', async () => {
      mockSelectFirms.mockResolvedValueOnce({
        data: [
          { id: 'a', name: 'A', logo_url: null, website: null, last_payout_at: null },
          { id: 'b', name: 'B', logo_url: null, website: null, last_payout_at: null },
        ],
        error: null,
      });
      loadPeriodData
        .mockReturnValueOnce({ summary: { totalPayouts: 100, payoutCount: 1, largestPayout: 100, avgPayout: 100 } })
        .mockReturnValueOnce({ summary: { totalPayouts: 500, payoutCount: 2, largestPayout: 300, avgPayout: 250 } });

      const req = createRequest('https://x.com/api/v2/propfirms?period=7d&sort=totalPayouts&order=desc');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data[0].id).toBe('b');
      expect(body.data[0].metrics.totalPayouts).toBe(500);
      expect(body.data[1].id).toBe('a');
    });

    it('returns sorted data (asc)', async () => {
      mockSelectFirms.mockResolvedValueOnce({
        data: [
          { id: 'a', name: 'A', logo_url: null, website: null, last_payout_at: null },
          { id: 'b', name: 'B', logo_url: null, website: null, last_payout_at: null },
        ],
        error: null,
      });
      loadPeriodData
        .mockReturnValueOnce({ summary: { totalPayouts: 500, payoutCount: 1, largestPayout: 500, avgPayout: 500 } })
        .mockReturnValueOnce({ summary: { totalPayouts: 100, payoutCount: 1, largestPayout: 100, avgPayout: 100 } });

      const req = createRequest('https://x.com/api/v2/propfirms?period=7d&sort=totalPayouts&order=asc');
      const res = await GET(req);
      const body = await res.json();

      expect(body.data[0].id).toBe('b');
      expect(body.data[1].id).toBe('a');
    });

    it('falls back to file firms when Supabase returns no firms', async () => {
      mockSelectFirms.mockResolvedValueOnce({ data: [], error: null });
      fs.readFileSync.mockReturnValue(
        JSON.stringify({ firms: [{ id: 'file-firm', name: 'From File' }] })
      );
      loadPeriodData.mockReturnValue({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0, avgPayout: 0 },
      });

      const req = createRequest('https://x.com/api/v2/propfirms?period=7d');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('file-firm');
      expect(body.data[0].name).toBe('From File');
    });

    it('returns metadata (period, sort, order, count)', async () => {
      loadPeriodData.mockReturnValue({
        summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0, avgPayout: 0 },
      });
      const req = createRequest('https://x.com/api/v2/propfirms?period=30d&sort=payoutCount&order=asc');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.meta).toEqual({
        period: '30d',
        sort: 'payoutCount',
        order: 'asc',
        count: 1,
      });
    });
  });

  describe('error handling', () => {
    it('returns 429 when rate limited', async () => {
      isRateLimited.mockReturnValue({ limited: true, retryAfterMs: 30_000 });

      const req = createRequest('https://x.com/api/v2/propfirms');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(429);
      expect(body.error).toBe('Rate limit exceeded');
      expect(res.headers.get('Retry-After')).toBeDefined();
    });

    it('returns 403 for forbidden origin', async () => {
      validateOrigin.mockReturnValue({ ok: false, headers: {} });

      const req = createRequest('https://x.com/api/v2/propfirms', { Origin: 'https://evil.com' });
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body.error).toBe('Forbidden origin');
    });

    it('returns 500 on database error', async () => {
      mockSelectFirms.mockRejectedValueOnce(new Error('Connection refused'));

      const req = createRequest('https://x.com/api/v2/propfirms');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toContain('Connection refused');
    });
  });

  describe('parameter validation', () => {
    it('defaults to 1d period for invalid period', async () => {
      const req = createRequest('https://x.com/api/v2/propfirms?period=invalid');
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.meta.period).toBe('1d');
    });

    it('defaults to totalPayouts sort for invalid sort', async () => {
      const req = createRequest('https://x.com/api/v2/propfirms?sort=invalidField');
      const res = await GET(req);
      const body = await res.json();

      expect(body.meta.sort).toBe('totalPayouts');
    });

    it('defaults to desc order for invalid order', async () => {
      const req = createRequest('https://x.com/api/v2/propfirms?order=invalid');
      const res = await GET(req);
      const body = await res.json();

      expect(body.meta.order).toBe('desc');
    });
  });

  describe('CORS headers', () => {
    it('sets Access-Control-Allow-Origin when origin allowed', async () => {
      validateOrigin.mockReturnValue({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:3000' },
      });

      const req = createRequest('https://x.com/api/v2/propfirms');
      const res = await GET(req);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('sets Access-Control-Allow-Methods when returned by validateOrigin', async () => {
      validateOrigin.mockReturnValue({
        ok: true,
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:3000',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });

      const req = createRequest('https://x.com/api/v2/propfirms');
      const res = await GET(req);

      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    });
  });
});
