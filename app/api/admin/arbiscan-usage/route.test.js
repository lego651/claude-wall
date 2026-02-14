/**
 * Tests for GET /api/admin/arbiscan-usage
 */
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';
import { usageTracker } from '@/lib/arbiscan';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/arbiscan', () => ({
  usageTracker: { getUsage: jest.fn() },
}));

describe('GET /api/admin/arbiscan-usage', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
          }),
        }),
      }),
    };
    createClient.mockResolvedValue(mockSupabase);
    usageTracker.getUsage.mockReturnValue({
      calls: 100,
      limit: 100000,
      percentage: 0.1,
      day: '2025-01-15',
    });
  });

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { is_admin: false } }),
        }),
      }),
    });
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 200 with usage stats when admin', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.calls).toBe(100);
    expect(body.limit).toBe(100000);
    expect(body.percentage).toBe(0.1);
    expect(body.day).toBe('2025-01-15');
    expect(usageTracker.getUsage).toHaveBeenCalled();
  });
});
