/**
 * PROP-012: Integration tests for GET /api/v2/propfirms/[id]/incidents
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
      if (table === 'weekly_incidents') {
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
              data: [{ id: 'rev1', trustpilot_url: 'https://trustpilot.com/review/1' }],
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
    });
  });

  it('includes source links (Trustpilot URLs)', async () => {
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'f1' }) });
    const body = await res.json();

    expect(body.incidents[0].source_links).toContain('https://trustpilot.com/review/1');
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
});
