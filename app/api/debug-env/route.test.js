/**
 * Tests for GET /api/debug-env
 */
import { GET } from './route';

describe('GET /api/debug-env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 without Authorization header', async () => {
    process.env.CRON_SECRET = 'secret';
    const req = new Request('https://example.com/api/debug-env');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 with wrong Bearer token', async () => {
    process.env.CRON_SECRET = 'secret';
    const req = new Request('https://example.com/api/debug-env', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct Bearer token and returns env flags', async () => {
    process.env.CRON_SECRET = 'secret';
    process.env.ARBISCAN_API_KEY = 'key';
    process.env.VERCEL_ENV = 'production';
    const req = new Request('https://example.com/api/debug-env', {
      headers: { authorization: 'Bearer secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ARBISCAN_API_KEY).toBe('set');
    expect(body.ok).toBe(true);
    expect(body.VERCEL_ENV).toBe('production');
  });

  it('returns ok: false when ARBISCAN_API_KEY is missing', async () => {
    process.env.CRON_SECRET = 'secret';
    delete process.env.ARBISCAN_API_KEY;
    const req = new Request('https://example.com/api/debug-env', {
      headers: { authorization: 'Bearer secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ARBISCAN_API_KEY).toBe('missing');
    expect(body.ok).toBe(false);
  });
});
