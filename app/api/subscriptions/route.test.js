/**
 * Tests for GET and POST /api/subscriptions
 */
import { GET, POST } from './route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

describe('/api/subscriptions', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: jest.fn(),
    };
    createClient.mockResolvedValue(mockSupabase);
  });

  describe('GET', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 500 when fetch subscriptions fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      });
      const res = await GET();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Failed to fetch subscriptions');
    });

    it('returns 200 with subscriptions list', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'user_subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 1,
                      firm_id: 'fp',
                      subscribed_at: '2025-01-01T00:00:00Z',
                      email_enabled: true,
                      firm_profiles: { id: 'fp', name: 'FundingPips', logo_url: null, website: 'https://fp.com' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.subscriptions).toHaveLength(1);
      expect(body.subscriptions[0].firm_id).toBe('fp');
      expect(body.subscriptions[0].firm?.name).toBe('FundingPips');
      expect(body.subscriptions[0].next_report_date).toBeDefined();
    });

    it('returns 200 with empty list when no subscriptions', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.subscriptions).toEqual([]);
    });

    it('returns 500 when GET throws', async () => {
      mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('auth failed'));
      const res = await GET();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('POST', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 'fp' }) }));
      expect(res.status).toBe(401);
    });

    it('returns 400 when body is invalid JSON', async () => {
      const res = await POST(new Request('https://x.com', { method: 'POST', body: 'not json' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid JSON body');
    });

    it('returns 400 when firm_id is missing', async () => {
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({}) }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('firm_id is required');
    });

    it('returns 400 when firm_id is not a string', async () => {
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 123 }) }));
      expect(res.status).toBe(400);
    });

    it('returns 404 when firm not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 'nonexistent' }) }));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('Firm not found');
    });

    it('returns 200 with already_subscribed when subscription exists', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'firm_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'fp', name: 'FundingPips', logo_url: null, website: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn()
                    .mockResolvedValueOnce({
                      data: { id: 1, subscribed_at: '2025-01-01Z', email_enabled: true },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 'fp' }) }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.already_subscribed).toBe(true);
      expect(body.subscription.firm_id).toBe('fp');
    });

    it('returns 200 with new subscription on insert', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'firm_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'fp', name: 'FundingPips', logo_url: null, website: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                  single: jest.fn().mockResolvedValue({ data: { id: 2, subscribed_at: '2025-02-01Z', email_enabled: true }, error: null }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 2, subscribed_at: '2025-02-01Z', email_enabled: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: ' FP ' }) }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.already_subscribed).toBe(false);
      expect(body.subscription.firm_id).toBe('fp');
    });

    it('returns 500 when existing check fails', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'firm_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'fp', name: 'FP', logo_url: null, website: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 'fp' }) }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Failed to check subscription');
    });

    it('returns 200 with already_subscribed when insert returns 23505 and select returns row', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'firm_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'fp', name: 'FP', logo_url: null, website: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                  single: jest.fn().mockResolvedValue({ data: { id: 3, subscribed_at: '2025-01-15Z', email_enabled: true }, error: null }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 'fp' }) }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.already_subscribed).toBe(true);
      expect(body.subscription.firm_id).toBe('fp');
    });

    it('returns 500 when insert fails with 23505 but select returns no row', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'firm_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'fp', name: 'FP', logo_url: null, website: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 'fp' }) }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Failed to create subscription');
    });

    it('returns 500 when insert fails with non-23505 error', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'firm_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'fp', name: 'FP', logo_url: null, website: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_subscriptions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'insert failed' } }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await POST(new Request('https://x.com', { method: 'POST', body: JSON.stringify({ firm_id: 'fp' }) }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('Failed to create subscription');
    });
  });
});
