/**
 * PROP-012: Integration tests for GET /api/v2/propfirms/[id]/latest-payouts
 */

import { GET } from './route';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/apiSecurity');
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/middleware/requestId', () => ({
  getRequestId: () => 'test-req-id',
  setRequestIdHeader: jest.fn(),
}));

function createRequest(url = 'https://x.com/api/v2/propfirms/f1/latest-payouts') {
  return new Request(url, { headers: { Origin: 'http://localhost:3000' } });
}

describe('GET /api/v2/propfirms/[id]/latest-payouts', () => {
  let mockFrom;
  let mockSingle;
  let mockOrder;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    validateOrigin.mockReturnValue({ ok: true, headers: {} });
    isRateLimited.mockReturnValue({ limited: false, retryAfterMs: 60_000 });

    mockSingle = jest.fn().mockResolvedValue({ data: { id: 'f1' }, error: null });
    mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
    mockFrom = jest.fn().mockImplementation((table) => {
      if (table === 'firms') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ single: mockSingle }),
          }),
        };
      }
      if (table === 'recent_payouts') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              gte: jest.fn().mockReturnValue({ order: mockOrder }),
            }),
          }),
        };
      }
      return {};
    });
    createClient.mockReturnValue({ from: mockFrom });
  });

  it('returns payouts from last 24h', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'f1' }, error: null });
    mockOrder.mockResolvedValueOnce({
      data: [
        {
          tx_hash: '0xabc',
          amount: 1000,
          payment_method: 'rise',
          timestamp: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.payouts).toHaveLength(1);
    expect(body.payouts[0]).toMatchObject({
      id: '0xabc',
      amount: 1000,
      paymentMethod: 'rise',
      arbiscanUrl: 'https://arbiscan.io/tx/0xabc',
    });
    expect(body.count).toBe(1);
  });

  it('returns empty array if no payouts', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.payouts).toEqual([]);
    expect(body.count).toBe(0);
  });

  it('returns 404 for non-existent firm', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Firm not found');
  });

  it('includes Arbiscan URLs in each payout', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [
        {
          tx_hash: '0xhash123',
          amount: 500,
          payment_method: 'crypto',
          timestamp: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const req = createRequest();
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.payouts[0].arbiscanUrl).toBe('https://arbiscan.io/tx/0xhash123');
  });
});
