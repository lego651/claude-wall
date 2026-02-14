/**
 * Tests for POST /api/admin/test-alert
 */
import { POST } from './route';
import { createClient } from '@/lib/supabase/server';
import { sendAlert } from '@/lib/alerts';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/alerts');

describe('POST /api/admin/test-alert', () => {
  let mockSupabase;
  let mockGetUser;
  let mockFrom;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { is_admin: true },
          }),
        }),
      }),
    });
    mockSupabase = {
      auth: { getUser: mockGetUser },
      from: mockFrom,
    };
    createClient.mockResolvedValue(mockSupabase);
    sendAlert.mockResolvedValue(undefined);
    process.env.ALERT_EMAIL = 'alert@test.com';
    process.env.RESEND_API_KEY = 'key';
  });

  afterEach(() => {
    delete process.env.ALERT_EMAIL;
    delete process.env.ALERTS_TO;
    delete process.env.RESEND_API_KEY;
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not admin', async () => {
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { is_admin: false } }),
        }),
      }),
    });
    const res = await POST();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('returns 400 when ALERT_EMAIL is not set', async () => {
    delete process.env.ALERT_EMAIL;
    delete process.env.ALERTS_TO;
    const res = await POST();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/ALERT_EMAIL|ALERTS_TO/);
  });

  it('returns 200 and sends alert when admin and env set', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(sendAlert).toHaveBeenCalledWith(
      'Admin dashboard',
      expect.stringContaining('Test alert'),
      'INFO',
      expect.objectContaining({ test: true })
    );
  });
});
