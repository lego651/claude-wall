/**
 * PROP-012: Integration tests for GET /api/v2/propfirms/[id]/top-payouts
 */

import { GET } from './route';
import { createClient } from '@supabase/supabase-js';
import { getTopPayoutsFromFiles } from '@/lib/services/payoutDataLoader';
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
jest.mock('@/lib/cache', () => ({
  cache: { get: jest.fn(), set: jest.fn() },
}));

function createRequest(url = 'https://x.com/api/v2/propfirms/f1/top-payouts') {
  return new Request(url, { headers: { Origin: 'http://localhost:3000' } });
}

describe('GET /api/v2/propfirms/[id]/top-payouts', () => {
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

    mockSingle = jest.fn().mockResolvedValue({ data: { id: 'f1' }, error: null });
    mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
    createClient.mockReturnValue({ from: mockFrom });
  });

  it('returns top 10 payouts for 30d', async () => {
    const payouts = [
      { id: '0xa', amount: 5000, paymentMethod: 'rise', date: '2025-01-15', txHash: '0xa', arbiscanUrl: 'https://arbiscan.io/tx/0xa' },
      { id: '0xb', amount: 3000, paymentMethod: 'rise', date: '2025-01-14', txHash: '0xb', arbiscanUrl: 'https://arbiscan.io/tx/0xb' },
    ];
    getTopPayoutsFromFiles.mockReturnValue(payouts);

    const req = createRequest('https://x.com/api/v2/propfirms/f1/top-payouts?period=30d');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.period).toBe('30d');
    expect(body.payouts).toHaveLength(2);
    expect(getTopPayoutsFromFiles).toHaveBeenCalledWith('f1', '30d', 5000);
  });

  it('returns top 10 payouts for 12m', async () => {
    getTopPayoutsFromFiles.mockReturnValue([
      { id: '0xc', amount: 10000, paymentMethod: 'rise', date: '2025-01-01', txHash: '0xc', arbiscanUrl: 'https://arbiscan.io/tx/0xc' },
    ]);

    const req = createRequest('https://x.com/api/v2/propfirms/f1/top-payouts?period=12m');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.period).toBe('12m');
    expect(getTopPayoutsFromFiles).toHaveBeenCalledWith('f1', '12m', 5000);
  });

  it('filters to Rise payments only', async () => {
    getTopPayoutsFromFiles.mockReturnValue([
      { id: '0x1', amount: 5000, paymentMethod: 'rise', date: '2025-01-15', txHash: '0x1', arbiscanUrl: 'https://arbiscan.io/tx/0x1' },
      { id: '0x2', amount: 4000, paymentMethod: 'crypto', date: '2025-01-14', txHash: '0x2', arbiscanUrl: 'https://arbiscan.io/tx/0x2' },
    ]);

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.payouts).toHaveLength(1);
    expect(body.payouts[0].paymentMethod).toBe('rise');
  });

  it('returns 404 for non-existent firm', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Firm not found');
  });

  it('returns 403 when origin is invalid', async () => {
    validateOrigin.mockReturnValueOnce({ ok: false, headers: {} });
    const req = createRequest('https://evil.com/api/v2/propfirms/f1/top-payouts');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    isRateLimited.mockReturnValueOnce({ limited: true, retryAfterMs: 30_000 });
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    expect(res.status).toBe(429);
  });

  it('returns cached response when cache hit', async () => {
    const { cache } = require('@/lib/cache');
    const cachedBody = { firmId: 'f1', period: '30d', payouts: [] };
    cache.get.mockResolvedValueOnce(cachedBody);

    const req = createRequest('https://x.com/api/v2/propfirms/f1/top-payouts?period=30d');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(cachedBody);
    expect(getTopPayoutsFromFiles).not.toHaveBeenCalled();
  });

  it('sorted by amount descending (Rise-only slice)', async () => {
    getTopPayoutsFromFiles.mockReturnValue([
      { id: '0xh', amount: 9000, paymentMethod: 'rise', date: '2025-01-12', txHash: '0xh', arbiscanUrl: '...' },
      { id: '0xl', amount: 1000, paymentMethod: 'rise', date: '2025-01-10', txHash: '0xl', arbiscanUrl: '...' },
    ]);

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.payouts[0].amount).toBe(9000);
    expect(body.payouts[1].amount).toBe(1000);
  });
});
