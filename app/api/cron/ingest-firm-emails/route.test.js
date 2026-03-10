/**
 * Tests for GET /api/cron/ingest-firm-emails
 */

import { GET } from './route';
import { ingestFirmEmails } from '@/lib/gmail/ingest';

jest.mock('@/lib/gmail/ingest');

const mockIngestFirmEmails = ingestFirmEmails;

function createRequest(authHeader) {
  const headers = {};
  if (authHeader !== undefined) headers['authorization'] = authHeader;
  return new Request('https://example.com/api/cron/ingest-firm-emails', { headers });
}

describe('GET /api/cron/ingest-firm-emails', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    mockIngestFirmEmails.mockResolvedValue({ processed: 5, inserted: 3, skipped: 1, errors: 1 });
  });

  afterEach(() => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
  });

  it('returns 200 with ingest results on success', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

    const req = createRequest();
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(5);
    expect(body.inserted).toBe(3);
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('duration');
  });

  it('returns 401 in production without auth header', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });

    const req = createRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 in production with wrong secret', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });

    const req = createRequest('Bearer wrong-secret');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockIngestFirmEmails).not.toHaveBeenCalled();
  });

  it('returns 200 in production with correct secret', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });

    const req = createRequest('Bearer test-secret');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockIngestFirmEmails).toHaveBeenCalled();
  });

  it('returns 500 when ingest throws', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    mockIngestFirmEmails.mockRejectedValue(new Error('Gmail unreachable'));

    const req = createRequest();
    const res = await GET(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Gmail unreachable');
  });

  it('skips auth check in development even with CRON_SECRET set', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

    const req = createRequest(); // no auth header
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockIngestFirmEmails).toHaveBeenCalled();
  });
});
