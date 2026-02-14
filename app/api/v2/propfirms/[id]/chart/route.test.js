/**
 * PROP-012: Integration tests for GET /api/v2/propfirms/[id]/chart
 */

import { GET } from './route';
import { createClient } from '@supabase/supabase-js';
import { loadPeriodData } from '@/lib/services/payoutDataLoader';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/services/payoutDataLoader');
jest.mock('@/lib/apiSecurity');
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/middleware/requestId', () => ({
  getRequestId: () => 'test-req-id',
  setRequestIdHeader: jest.fn(),
}));
jest.mock('@/lib/cache', () => ({ cache: { get: jest.fn(), set: jest.fn() } }));
jest.mock('@/lib/supabaseQuery', () => ({
  withQueryGuard: (promise) => promise,
}));

function createRequest(url = 'https://x.com/api/v2/propfirms/f1/chart') {
  return new Request(url, { headers: { Origin: 'http://localhost:3000' } });
}

describe('GET /api/v2/propfirms/[id]/chart', () => {
  let mockFrom;
  let mockSelect;
  let mockEq;
  let mockSingle;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    validateOrigin.mockReturnValue({ ok: true, headers: {} });
    isRateLimited.mockReturnValue({ limited: false, retryAfterMs: 60_000 });

    mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'f1', name: 'Firm One', logo_url: null, website: null, last_payout_at: null },
      error: null,
    });
    mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
    createClient.mockReturnValue({ from: mockFrom });
  });

  it('returns 200 for valid firm', async () => {
    loadPeriodData.mockReturnValue({
      summary: { totalPayouts: 1000, payoutCount: 5, largestPayout: 500, avgPayout: 200 },
      dailyBuckets: [{ date: '2025-01-15', total: 200, rise: 0, crypto: 200, wire: 0 }],
    });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.firm.id).toBe('f1');
    expect(body.summary.totalPayouts).toBe(1000);
    expect(body.chart.period).toBe('30d');
    expect(body.chart.bucketType).toBe('daily');
  });

  it('returns 404 for non-existent firm', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Firm not found');
  });

  it('returns daily buckets for 30d period', async () => {
    const buckets = [{ date: '2025-01-10', total: 100, rise: 50, crypto: 50, wire: 0 }];
    loadPeriodData.mockReturnValue({ summary: {}, dailyBuckets: buckets });

    const req = createRequest('https://x.com/api/v2/propfirms/f1/chart?period=30d');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chart.bucketType).toBe('daily');
    expect(body.chart.data.length).toBe(30);
    expect(loadPeriodData).toHaveBeenCalledWith('f1', '30d');
  });

  it('returns monthly buckets for 12m period', async () => {
    const buckets = [{ month: 'Jan 2025', total: 5000, rise: 3000, crypto: 2000, wire: 0 }];
    loadPeriodData.mockReturnValue({ summary: {}, monthlyBuckets: buckets });

    const req = createRequest('https://x.com/api/v2/propfirms/f1/chart?period=12m');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chart.bucketType).toBe('monthly');
    expect(body.chart.data).toEqual(buckets);
    expect(loadPeriodData).toHaveBeenCalledWith('f1', '12m');
  });

  it('fills gaps with zero values for 30d', async () => {
    loadPeriodData.mockReturnValue({
      summary: {},
      dailyBuckets: [{ date: '2025-01-15', total: 100, rise: 0, crypto: 100, wire: 0 }],
    });

    const req = createRequest('https://x.com/api/v2/propfirms/f1/chart?period=30d');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.chart.data.length).toBe(30);
    const zeros = body.chart.data.filter((d) => d.total === 0);
    expect(zeros.length).toBeGreaterThanOrEqual(1);
    expect(zeros[0]).toMatchObject({ total: 0, rise: 0, crypto: 0, wire: 0 });
  });

  it('returns summary metrics', async () => {
    loadPeriodData.mockReturnValue({
      summary: {
        totalPayouts: 5000,
        payoutCount: 10,
        largestPayout: 1000,
        avgPayout: 500,
      },
      dailyBuckets: [],
    });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.summary).toMatchObject({
      totalPayouts: 5000,
      payoutCount: 10,
      largestPayout: 1000,
      avgPayout: 500,
    });
  });

  it('returns 403 when validateOrigin fails', async () => {
    validateOrigin.mockReturnValue({ ok: false, headers: {} });
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden origin');
  });

  it('returns 429 when rate limited', async () => {
    isRateLimited.mockReturnValue({ limited: true, retryAfterMs: 5000 });
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error).toBe('Rate limit exceeded');
    expect(res.headers.get('Retry-After')).toBe('5');
  });

  it('returns cached response on cache hit', async () => {
    const { cache } = require('@/lib/cache');
    const cached = { firm: { id: 'f1', name: 'F1', logo: null }, summary: {}, chart: { period: '30d', bucketType: 'daily', data: [] } };
    cache.get.mockResolvedValue(cached);
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(cached);
    expect(loadPeriodData).not.toHaveBeenCalled();
  });

  it('returns 500 when loadPeriodData throws', async () => {
    loadPeriodData.mockRejectedValue(new Error('load failed'));
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('load failed');
  });
});
