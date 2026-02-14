/**
 * Tests for GET /api/admin/metrics
 */
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';
import { usageTracker } from '@/lib/arbiscan';
import { getCacheStats } from '@/lib/cache';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/arbiscan', () => ({
  usageTracker: { getUsage: jest.fn() },
}));
jest.mock('@/lib/cache');
jest.mock('@/lib/alerts', () => ({ sendAlert: jest.fn() }));
jest.mock('fs', () => ({
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn(),
  },
}));

describe('GET /api/admin/metrics', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
          }),
        }),
      }),
    };
    createClient.mockResolvedValue(mockSupabase);
    usageTracker.getUsage.mockReturnValue({ calls: 0, limit: 100000, percentage: 0, day: '2025-01-15' });
    getCacheStats.mockReturnValue({ size: 0, keys: 0 });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: false } }),
            }),
          }),
        };
      }
      return { select: jest.fn().mockReturnValue({ gte: jest.fn().mockResolvedValue({ data: [] }) }) };
    });
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 with metrics when admin', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (['firms', 'recent_payouts', 'trustpilot_reviews', 'weekly_incidents'].includes(table)) {
        return {
          select: jest.fn().mockResolvedValue({ count: 0, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [] }),
        }),
      };
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('database');
    expect(body).toHaveProperty('files');
    expect(body).toHaveProperty('arbiscan');
  });
});
