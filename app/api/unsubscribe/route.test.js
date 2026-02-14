/**
 * Tests for GET /api/unsubscribe
 */
import { GET } from './route';

jest.mock('@/lib/supabase/service', () => ({
  __esModule: true,
  createServiceClient: jest.fn(() => ({
    from: () => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  })),
}));
jest.mock('@/lib/email/unsubscribe-token', () => ({
  verifyUnsubscribeToken: jest.fn(),
}));

const defaultServiceClient = {
  from: () => ({
    update: () => ({
      eq: () => Promise.resolve({ error: null }),
    }),
  }),
};

describe('GET /api/unsubscribe', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const { verifyUnsubscribeToken } = await import('@/lib/email/unsubscribe-token');
    const { createServiceClient } = await import('@/lib/supabase/service');
    verifyUnsubscribeToken.mockResolvedValue('user-id-123');
    createServiceClient.mockImplementation(() => defaultServiceClient);
  });

  it('redirects to error when token is missing', async () => {
    const req = new Request('https://example.com/api/unsubscribe');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('error=missing_token');
  });

  it('redirects to error when token is invalid', async () => {
    const { verifyUnsubscribeToken } = await import('@/lib/email/unsubscribe-token');
    verifyUnsubscribeToken.mockRejectedValueOnce(new Error('Invalid token'));
    const req = new Request('https://example.com/api/unsubscribe?token=bad');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('error=invalid_token');
  });

  it('redirects to unsubscribed=1 when token is valid', async () => {
    const req = new Request('https://example.com/api/unsubscribe?token=valid-token');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toContain('unsubscribed=1');
  });

  it('redirects to invalid_token when verifyToken returns null', async () => {
    const { verifyUnsubscribeToken } = await import('@/lib/email/unsubscribe-token');
    verifyUnsubscribeToken.mockResolvedValueOnce(null);
    const req = new Request('https://example.com/api/unsubscribe?token=empty-user');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('error=invalid_token');
  });

  it('redirects to update_failed when supabase update returns error', async () => {
    const { createServiceClient } = await import('@/lib/supabase/service');
    createServiceClient.mockImplementationOnce(() => ({
      from: () => ({
        update: () => ({
          eq: () => Promise.resolve({ error: { message: 'update failed' } }),
        }),
      }),
    }));
    const { verifyUnsubscribeToken } = await import('@/lib/email/unsubscribe-token');
    verifyUnsubscribeToken.mockResolvedValueOnce('user-id-123');
    const req = new Request('https://example.com/api/unsubscribe?token=valid-token');
    const res = await GET(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('error=update_failed');
  });
});
