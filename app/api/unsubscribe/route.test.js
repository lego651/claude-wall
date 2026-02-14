/**
 * Tests for GET /api/unsubscribe
 */
import { GET } from './route';

jest.mock('@/lib/supabase/service', () => ({
  __esModule: true,
  createServiceClient: function () {
    return {
      from: () => ({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    };
  },
}));
jest.mock('@/lib/email/unsubscribe-token', () => ({
  verifyUnsubscribeToken: jest.fn(),
}));

describe('GET /api/unsubscribe', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const { verifyUnsubscribeToken } = await import('@/lib/email/unsubscribe-token');
    verifyUnsubscribeToken.mockResolvedValue('user-id-123');
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
});
