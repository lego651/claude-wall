/**
 * Tests for sendWeeklyDigest (lib/email/send-digest.ts)
 */
import { sendWeeklyDigest } from '../send-digest';

jest.mock('@/lib/resend', () => ({
  sendEmail: jest.fn(),
}));
jest.mock('@/lib/email/weekly-digest-html', () => ({
  buildWeeklyDigestHtml: jest.fn(() => '<html>digest</html>'),
}));
jest.mock('@/lib/email/unsubscribe-token', () => ({
  createUnsubscribeToken: jest.fn(() => 'mock-token'),
}));
const mockCachedData = { firmContent: new Map(), industryNews: [] };
jest.mock('@/lib/digest/weekly-cache', () => ({
  getCachedWeeklyDigestData: jest.fn(),
}));
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(() => ({
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  })),
}));

const mockReports = [
  {
    firmId: 'fp',
    weekStart: '2025-01-06',
    weekEnd: '2025-01-12',
    payouts: { total: 1, count: 1, largest: 1, avgPayout: 1, changeVsLastWeek: null },
    trustpilot: { avgRating: 4, ratingChange: null, reviewCount: 10, sentiment: { positive: 5, neutral: 3, negative: 2 } },
    incidents: [],
    ourTake: 'Good week.',
  },
];

describe('sendWeeklyDigest', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, RESEND_API_KEY: 'key' };
    const { getCachedWeeklyDigestData } = require('@/lib/digest/weekly-cache');
    (getCachedWeeklyDigestData as jest.Mock).mockResolvedValue(mockCachedData);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns error when user has no email', async () => {
    const result = await sendWeeklyDigest(
      { id: 'u1', email: undefined },
      mockReports,
      { weekStart: '2025-01-06', weekEnd: '2025-01-12', baseUrl: 'https://example.com' }
    );
    expect(result).toEqual({ ok: false, error: 'User has no email' });
  });

  it('returns error when user email is empty string', async () => {
    const result = await sendWeeklyDigest(
      { id: 'u1', email: '   ' },
      mockReports,
      { weekStart: '2025-01-06', weekEnd: '2025-01-12', baseUrl: 'https://example.com' }
    );
    expect(result).toEqual({ ok: false, error: 'User has no email' });
  });

  it('returns error when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendWeeklyDigest(
      { id: 'u1', email: 'u@example.com' },
      mockReports,
      { weekStart: '2025-01-06', weekEnd: '2025-01-12', baseUrl: 'https://example.com' }
    );
    expect(result).toEqual({ ok: false, error: 'RESEND_API_KEY not set' });
  });

  it('returns error when sendEmail throws', async () => {
    const { sendEmail } = await import('@/lib/resend');
    (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('Resend failed'));
    const result = await sendWeeklyDigest(
      { id: 'u1', email: 'u@example.com' },
      mockReports,
      { weekStart: '2025-01-06', weekEnd: '2025-01-12', baseUrl: 'https://example.com' }
    );
    expect(result).toEqual({ ok: false, error: 'Resend failed' });
  });

  it('returns ok true and updates last_sent_at on success', async () => {
    const { sendEmail } = await import('@/lib/resend');
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);
    const { createServiceClient } = await import('@/lib/supabase/service');
    const mockUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });
    (createServiceClient as jest.Mock).mockReturnValueOnce({ from: mockFrom });

    const result = await sendWeeklyDigest(
      { id: 'u1', email: 'u@example.com' },
      mockReports,
      { weekStart: '2025-01-06', weekEnd: '2025-01-12', baseUrl: 'https://example.com' }
    );

    expect(result).toEqual({ ok: true });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'u@example.com',
        subject: expect.stringContaining('2025-01-06'),
      })
    );
    expect(mockFrom).toHaveBeenCalledWith('user_subscriptions');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ last_sent_at: expect.any(String) }));
  });

  it('returns ok true when last_sent_at update fails (email already sent)', async () => {
    const { sendEmail } = await import('@/lib/resend');
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);
    const { createServiceClient } = await import('@/lib/supabase/service');
    (createServiceClient as jest.Mock).mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      }),
    });

    const result = await sendWeeklyDigest(
      { id: 'u1', email: 'u@example.com' },
      mockReports,
      { weekStart: '2025-01-06', weekEnd: '2025-01-12', baseUrl: 'https://example.com' }
    );

    expect(result).toEqual({ ok: true });
  });

  it('strips trailing slash from baseUrl', async () => {
    const { sendEmail } = await import('@/lib/resend');
    (sendEmail as jest.Mock).mockResolvedValueOnce(undefined);
    const { buildWeeklyDigestHtml } = await import('@/lib/email/weekly-digest-html');
    await sendWeeklyDigest(
      { id: 'u1', email: 'u@example.com' },
      mockReports,
      { weekStart: '2025-01-06', weekEnd: '2025-01-12', baseUrl: 'https://example.com/' }
    );
    expect(buildWeeklyDigestHtml).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        manageSubscriptionsUrl: 'https://example.com/user/settings',
        unsubscribeUrl: expect.stringContaining('https://example.com/api/unsubscribe'),
      })
    );
  });
});
