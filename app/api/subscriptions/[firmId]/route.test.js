/**
 * Tests for DELETE /api/subscriptions/[firmId]
 */
import { DELETE } from './route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

describe('DELETE /api/subscriptions/[firmId]', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
              }),
            }),
          }),
        }),
      }),
    };
    createClient.mockResolvedValue(mockSupabase);
  });

  it('returns 400 when firmId is missing', async () => {
    const res = await DELETE(null, { params: Promise.resolve({ firmId: '' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Firm ID is required');
  });

  it('returns 400 when firmId is not a string', async () => {
    const res = await DELETE(null, { params: Promise.resolve({ firmId: 123 }) });
    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await DELETE(null, { params: Promise.resolve({ firmId: 'fp' }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when delete fails', async () => {
    mockSupabase.from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }),
    });
    const res = await DELETE(null, { params: Promise.resolve({ firmId: 'fp' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to delete subscription');
  });

  it('returns 404 when subscription not found', async () => {
    mockSupabase.from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });
    const res = await DELETE(null, { params: Promise.resolve({ firmId: 'fp' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Subscription not found');
  });

  it('returns 204 when delete succeeds', async () => {
    const res = await DELETE(null, { params: Promise.resolve({ firmId: 'fp' }) });
    expect(res.status).toBe(204);
    expect(res.body).toBe(null);
  });

  it('normalizes firmId to lowercase', async () => {
    const res = await DELETE(null, { params: Promise.resolve({ firmId: ' FP ' }) });
    expect(res.status).toBe(204);
    expect(mockSupabase.from).toHaveBeenCalledWith('user_subscriptions');
  });

  it('returns 500 when handler throws', async () => {
    mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('auth failed'));
    const res = await DELETE(null, { params: Promise.resolve({ firmId: 'fp' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
