/**
 * PROP-012: Integration tests for GET /api/v2/propfirms/[id]/signals
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

function createRequest(url = 'https://x.com/api/v2/propfirms/f1/signals') {
  return new Request(url, { headers: { Origin: 'http://localhost:3000' } });
}

describe('GET /api/v2/propfirms/[id]/signals', () => {
  let mockFrom;
  let mockSelect;
  let mockEq;
  let mockSingle;
  let mockGte;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    validateOrigin.mockReturnValue({ ok: true, headers: {} });
    isRateLimited.mockReturnValue({ limited: false, retryAfterMs: 60_000 });

    mockSingle = jest.fn().mockResolvedValue({ data: { id: 'f1', name: 'Firm One' }, error: null });
    mockGte = jest.fn().mockResolvedValue({ data: [], error: null });
    mockEq = jest.fn().mockImplementation((col) => {
      if (col === 'id') return { single: mockSingle };
      if (col === 'firm_id') return { gte: mockGte };
      return {};
    });
    mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
    createClient.mockReturnValue({ from: mockFrom });
    loadPeriodData.mockReturnValue({
      summary: { totalPayouts: 5000, payoutCount: 10, largestPayout: 1000, avgPayout: 500 },
    });
  });

  it('returns payout summary', async () => {
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.payout).toMatchObject({
      totalPayouts: 5000,
      payoutCount: 10,
      largestPayout: 1000,
      avgPayout: 500,
    });
    expect(loadPeriodData).toHaveBeenCalledWith('f1', '30d');
  });

  it('returns Trustpilot sentiment', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { category: 'positive_experience' },
        { category: 'payout_delay' },
        { category: 'neutral_mixed' },
      ],
      error: null,
    });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.trustpilot.reviewCount).toBe(3);
    expect(body.trustpilot.sentiment).toMatchObject({
      positive: 1,
      neutral: 1,
      negative: 1,
    });
  });

  it('filters reviews by date range (days param)', async () => {
    const req = createRequest('https://x.com/api/v2/propfirms/f1/signals?days=7');
    await GET(req, { params: Promise.resolve({ id: 'f1' }) });

    expect(mockGte).toHaveBeenCalledWith('review_date', expect.any(String));
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
    const req = createRequest('https://evil.com/api/v2/propfirms/f1/signals');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    isRateLimited.mockReturnValueOnce({ limited: true, retryAfterMs: 30_000 });
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    expect(res.status).toBe(429);
  });

  it('returns 500 when Trustpilot reviews query fails', async () => {
    mockGte.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });

  it('returns payout with avgPayout 0 when payoutCount is 0', async () => {
    loadPeriodData.mockReturnValueOnce({
      summary: { totalPayouts: 0, payoutCount: 0, largestPayout: 0 },
    });
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.payout.avgPayout).toBe(0);
    expect(body.payout.payoutCount).toBe(0);
  });

  it('counts reviews with unknown category as neither positive nor negative nor neutral', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { category: 'positive_experience' },
        { category: 'unknown_category' },
        { category: null },
      ],
      error: null,
    });
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(body.trustpilot.sentiment.positive).toBe(1);
    expect(body.trustpilot.sentiment.neutral).toBe(0);
    expect(body.trustpilot.sentiment.negative).toBe(0);
  });

  it('returns 500 when handler throws', async () => {
    mockSingle.mockRejectedValueOnce(new Error('Connection failed'));
    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
