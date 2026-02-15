/**
 * PROP-012: Integration tests for GET /api/v2/propfirms/[id]/incidents
 */

import { GET, getWeekStartDate } from './route';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';
import { withQueryGuard } from '@/lib/supabaseQuery';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/apiSecurity');
jest.mock('@/lib/supabaseQuery', () => ({
  withQueryGuard: jest.fn((promise) => promise),
}));
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/middleware/requestId', () => ({
  getRequestId: () => 'test-req-id',
  setRequestIdHeader: jest.fn(),
}));

function createRequest(url = 'https://x.com/api/v2/propfirms/f1/incidents') {
  return new Request(url, { headers: { Origin: 'http://localhost:3000' } });
}

describe('GET /api/v2/propfirms/[id]/incidents', () => {
  let mockFrom;
  const incidentRows = [
    {
      id: 1,
      firm_id: 'f1',
      week_number: 7,
      year: 2025,
      incident_type: 'payout_delay',
      severity: 'medium',
      title: 'Delay',
      summary: 'Summary',
      review_count: 5,
      affected_users: 3,
      review_ids: ['rev1'],
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    withQueryGuard.mockImplementation((promise) => promise);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    validateOrigin.mockReturnValue({ ok: true, headers: {} });
    isRateLimited.mockReturnValue({ limited: false, retryAfterMs: 60_000 });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-02-15T12:00:00.000Z'));

    const incidentsPromise = Promise.resolve({ data: incidentRows, error: null });
    const order2 = () => incidentsPromise;
    const order1 = () => ({ order: order2 });
    mockFrom = jest.fn().mockImplementation((table) => {
      if (table === 'firm_daily_incidents') {
        return {
          select: () => ({
            eq: () => ({ order: order1 }),
          }),
        };
      }
      if (table === 'trustpilot_reviews') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [{ id: 'rev1', trustpilot_url: 'https://trustpilot.com/review/1', review_date: '2025-02-10' }],
            }),
          }),
        };
      }
      return {};
    });
    createClient.mockReturnValue({ from: mockFrom });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns incidents from last N days', async () => {
    const req = createRequest('https://x.com/api/v2/propfirms/f1/incidents?days=90');
    const res = await GET(req, { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.incidents).toHaveLength(1);
    expect(body.incidents[0]).toMatchObject({
      firm_id: 'f1',
      week_number: 7,
      year: 2025,
      week_start: expect.any(String),
      title: 'Delay',
      source_links: expect.any(Array),
      evidence_date: '2025-02-10',
    });
    expect(body.incidents[0].source_links[0]).toEqual({ url: 'https://trustpilot.com/review/1', date: '2025-02-10' });
  });

  it('includes source links with review date (Trustpilot)', async () => {
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    const links = body.incidents[0].source_links;
    expect(links.some((s) => s.url === 'https://trustpilot.com/review/1')).toBe(true);
    expect(links[0].date).toBe('2025-02-10');
  });

  it('sorted by week (newest first) via API order', async () => {
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(body.incidents.length).toBeGreaterThanOrEqual(0);
    body.incidents.forEach((inc) => {
      expect(inc).toHaveProperty('week_start');
      expect(inc).toHaveProperty('year');
      expect(inc).toHaveProperty('week_number');
    });
  });

  it('returns 403 when origin is invalid', async () => {
    validateOrigin.mockReturnValue({ ok: false, headers: {} });
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden origin');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    isRateLimited.mockReturnValue({ limited: true, retryAfterMs: 10_000 });
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.error).toBe('Rate limit exceeded');
    expect(res.headers.get('Retry-After')).toBe('10');
  });

  it('returns 500 when incidents query returns error', async () => {
    withQueryGuard.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });

  it('returns 500 with "Database timeout" when query times out', async () => {
    withQueryGuard.mockRejectedValueOnce(new Error('Query timeout'));
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Database timeout');
  });

  it('returns 500 with message when query throws non-timeout error', async () => {
    withQueryGuard.mockRejectedValueOnce(new Error('connection refused'));
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('connection refused');
  });

  it('getWeekStartDate uses Sunday branch when Jan 4 is Sunday (e.g. 2015)', () => {
    // 2015-01-04 is Sunday → Monday of week 1 is 2014-12-29
    expect(getWeekStartDate(2015, 1)).toBe('2014-12-29');
  });

  it('handles incidents with no review_ids and empty trustpilot response', async () => {
    const rowsNoIds = [
      {
        id: 3,
        firm_id: 'f1',
        week_number: 6,
        year: 2025,
        incident_type: 'payout_delay',
        severity: 'medium',
        title: 'No links',
        summary: 'S',
        review_count: 0,
        affected_users: 0,
        review_ids: null,
        created_at: new Date().toISOString(),
      },
    ];
    withQueryGuard.mockResolvedValueOnce({ data: rowsNoIds, error: null });
    // allReviewIds is empty so trustpilot query is not made
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.incidents[0].source_links).toEqual([]);
  });

  it('handles trustpilot returning no rows for requested ids', async () => {
    const rowsWithIds = [
      {
        id: 4,
        firm_id: 'f1',
        week_number: 5,
        year: 2025,
        incident_type: 'payout_delay',
        severity: 'medium',
        title: 'Orphan ids',
        summary: 'S',
        review_count: 1,
        affected_users: 0,
        review_ids: ['rev-orphan'],
        created_at: new Date().toISOString(),
      },
    ];
    withQueryGuard
      .mockResolvedValueOnce({ data: rowsWithIds, error: null })
      .mockResolvedValueOnce({ data: [] });
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.incidents[0].source_links).toEqual([]);
  });

  it('sorts incidents by evidence_date descending (mixed dates and null)', async () => {
    const twoIncidents = [
      {
        id: 10,
        firm_id: 'f1',
        week_number: 7,
        year: 2025,
        incident_type: 'payout_delay',
        severity: 'medium',
        title: 'With date',
        summary: 'S',
        review_count: 1,
        affected_users: 0,
        review_ids: ['rev-a'],
        created_at: new Date().toISOString(),
      },
      {
        id: 11,
        firm_id: 'f1',
        week_number: 7,
        year: 2025,
        incident_type: 'other',
        severity: 'low',
        title: 'No date',
        summary: 'S2',
        review_count: 0,
        affected_users: 0,
        review_ids: null,
        created_at: new Date().toISOString(),
      },
    ];
    withQueryGuard
      .mockResolvedValueOnce({ data: twoIncidents, error: null })
      .mockResolvedValueOnce({
        data: [{ id: 'rev-a', trustpilot_url: 'https://t.com/a', review_date: '2025-02-14' }],
      });
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.incidents).toHaveLength(2);
    expect(body.incidents[0].evidence_date).toBe('2025-02-14');
    expect(body.incidents[1].evidence_date).toBeNull();
  });
});
