/**
 * Tests for GET /api/admin/twitter/history
 */
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

function buildMockSupabase({ user = { id: 'u1' }, isAdmin = true, rows = [], dbError = null } = {}) {
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
    from: jest.fn((table) => {
      if (table === 'user_profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: isAdmin } }),
            }),
          }),
        };
      }
      if (table === 'firm_twitter_tweets') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: rows, error: dbError }),
        };
      }
      return { select: jest.fn().mockReturnThis() };
    }),
  };
}

describe('GET /api/admin/twitter/history', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    createClient.mockResolvedValue(buildMockSupabase({ user: null }));
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when not admin', async () => {
    createClient.mockResolvedValue(buildMockSupabase({ isAdmin: false }));
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 7 days with zeros when no tweets found', async () => {
    createClient.mockResolvedValue(buildMockSupabase({ rows: [] }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toHaveLength(7);
    expect(body.totalLast7).toBe(0);
    expect(body.avgPerDay).toBe(0);
    expect(body.daysWithData).toBe(0);
    body.days.forEach((d) => {
      expect(d.firm).toBe(0);
      expect(d.industry).toBe(0);
      expect(d.total).toBe(0);
    });
  });

  it('correctly aggregates firm and industry tweets by day', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = [
      { created_at: `${today}T10:00:00Z`, firm_id: 'fundednext' },
      { created_at: `${today}T11:00:00Z`, firm_id: 'fundednext' },
      { created_at: `${today}T12:00:00Z`, firm_id: 'industry' },
    ];
    createClient.mockResolvedValue(buildMockSupabase({ rows }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    const todayRow = body.days[0];
    expect(todayRow.date).toBe(today);
    expect(todayRow.firm).toBe(2);
    expect(todayRow.industry).toBe(1);
    expect(todayRow.total).toBe(3);
    expect(body.totalLast7).toBe(3);
    expect(body.daysWithData).toBe(1);
  });

  it('returns 500 when DB query fails', async () => {
    createClient.mockResolvedValue(buildMockSupabase({ dbError: { message: 'table missing' } }));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('table missing');
  });
});
