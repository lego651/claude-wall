/**
 * Tests for POST /api/lead
 */
import { POST } from './route';
import { sendEmail } from '@/lib/resend';

jest.mock('@/lib/resend', () => ({
  sendEmail: jest.fn(),
}));

describe('POST /api/lead', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sendEmail as jest.Mock).mockResolvedValue(undefined);
  });

  it('returns 400 when email is missing', async () => {
    const req = new Request('https://example.com/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Email is required');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email format', async () => {
    const req = new Request('https://example.com/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid email format');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 200 and sends email for valid email', async () => {
    const req = new Request('https://example.com/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: "Thanks for signing up!",
      })
    );
  });

  it('accepts valid email with different casing', async () => {
    const req = new Request('https://example.com/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'User@Example.COM' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalled();
    const call = (sendEmail as jest.Mock).mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
  });

  it('returns 500 when sendEmail throws', async () => {
    (sendEmail as jest.Mock).mockRejectedValueOnce(new Error('Resend error'));
    const req = new Request('https://example.com/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
