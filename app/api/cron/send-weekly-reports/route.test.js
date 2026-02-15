/**
 * Tests for GET /api/cron/send-weekly-reports
 */
import { GET } from './route';

jest.mock('@/lib/supabase/service');
jest.mock('@/lib/email/send-digest');
jest.mock('@/lib/digest/week-utils', () => ({
  getWeekNumber: () => 6,
  getYear: () => 2025,
  getWeekBounds: () => ({
    weekStart: new Date('2025-02-03T00:00:00.000Z'),
    weekEnd: new Date('2025-02-09T23:59:59.999Z'),
  }),
}));

describe('GET /api/cron/send-weekly-reports', () => {
  const createClient = require('@/lib/supabase/service').createServiceClient;
  const sendWeeklyDigest = require('@/lib/email/send-digest').sendWeeklyDigest;

  const cronLastRunUpsertMock = () => ({ upsert: jest.fn().mockResolvedValue({ error: null }) });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    const mockFrom = jest.fn();
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })
      .mockReturnValueOnce(cronLastRunUpsertMock());
    createClient.mockReturnValue({ from: mockFrom });
  });

  it('returns 403 when Authorization header is missing', async () => {
    const req = new Request('https://example.com/api/cron/send-weekly-reports');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
    process.env.CRON_SECRET = 'test-secret';
  });

  it('returns 403 when Bearer token does not match', async () => {
    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer wrong' },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with sent 0 when no active subscribers', async () => {
    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.message).toBe('No active subscribers');
  });

  it('uses SITE_URL when set for baseUrl', async () => {
    const orig = process.env.SITE_URL;
    process.env.SITE_URL = 'https://app.example.com';
    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    process.env.SITE_URL = orig;
  });

  it('returns 500 when subscriptions query fails', async () => {
    const mockFrom = jest.fn();
    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    });
    createClient.mockReturnValue({ from: mockFrom });
    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch subscriptions');
  });

  it('returns 200 and sends one digest when one subscriber has reports', async () => {
    const userId = 'user-1';
    const firmId = 'fp';
    const mockFrom = jest.fn();
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: userId, firm_id: firmId }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: userId, email: 'u@example.com' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [
                  {
                    firm_id: firmId,
                    report_json: {
                      firmId,
                      weekStart: '2025-02-03',
                      weekEnd: '2025-02-09',
                      payouts: {},
                      trustpilot: {},
                      incidents: [],
                      ourTake: 'Ok',
                    },
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(cronLastRunUpsertMock());
    createClient.mockReturnValue({ from: mockFrom });
    sendWeeklyDigest.mockResolvedValue({ ok: true });

    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.failed).toBe(0);
    expect(sendWeeklyDigest).toHaveBeenCalledWith(
      { id: userId, email: 'u@example.com' },
      expect.any(Array),
      expect.objectContaining({ weekStart: '2025-02-03', weekEnd: '2025-02-09' })
    );
  });

  it('returns 200 with failed 1 when user has no email in profile', async () => {
    const userId = 'user-1';
    const mockFrom = jest.fn();
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: userId, firm_id: 'fp' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: userId, email: null }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(cronLastRunUpsertMock());
    createClient.mockReturnValue({ from: mockFrom });

    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(sendWeeklyDigest).not.toHaveBeenCalled();
  });

  it('returns 200 with skipped 1 when user has no reports for their firms', async () => {
    const userId = 'user-1';
    const mockFrom = jest.fn();
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: userId, firm_id: 'fp' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: userId, email: 'u@example.com' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(cronLastRunUpsertMock());
    createClient.mockReturnValue({ from: mockFrom });

    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.failed).toBe(0);
    expect(body.skipped).toBe(1);
    expect(sendWeeklyDigest).not.toHaveBeenCalled();
  });

  it('returns 500 when profiles query fails', async () => {
    const mockFrom = jest.fn();
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: 'user-1', firm_id: 'fp' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ data: null, error: { message: 'profiles error' } }),
        }),
      });
    createClient.mockReturnValue({ from: mockFrom });

    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch profiles');
  });

  it('returns 500 when weekly_reports query fails', async () => {
    const userId = 'user-1';
    const mockFrom = jest.fn();
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: userId, firm_id: 'fp' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: userId, email: 'u@example.com' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'reports error' } }),
            }),
          }),
        }),
      });
    createClient.mockReturnValue({ from: mockFrom });

    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch weekly reports');
  });

  it('returns 200 with failed 1 when sendWeeklyDigest returns not ok', async () => {
    const userId = 'user-1';
    const firmId = 'fp';
    const mockFrom = jest.fn();
    mockFrom
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: userId, firm_id: firmId }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: userId, email: 'u@example.com' }],
            error: null,
          }),
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ firm_id: firmId, report_json: { firmId, weekStart: '2025-02-03', weekEnd: '2025-02-09', payouts: {}, trustpilot: {}, incidents: [], ourTake: 'Ok' } }],
                error: null,
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(cronLastRunUpsertMock());
    createClient.mockReturnValue({ from: mockFrom });
    sendWeeklyDigest.mockResolvedValue({ ok: false, error: 'Resend failed' });

    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.failed).toBe(1);
    expect(body.errors[0]).toContain('Resend failed');
  });

  it('returns 500 when handler throws', async () => {
    createClient.mockImplementation(() => {
      throw new Error('supabase broken');
    });
    const req = new Request('https://example.com/api/cron/send-weekly-reports', {
      headers: { Authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('supabase broken');
  });
});
