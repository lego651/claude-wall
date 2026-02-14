/**
 * Tests for GET /api/trading-data/[...path]
 */
import { GET } from './route';
import fs from 'fs';

jest.mock('fs');

describe('GET /api/trading-data/[...path]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ week: 1, data: [] }));
  });

  it('returns 403 for path escaping trading-logs/data', async () => {
    // Path with .. can resolve outside trading-logs/data
    fs.existsSync.mockReturnValue(false);
    const req = new Request('https://example.com/api/trading-data/..%2Fetc%2Fpasswd');
    const res = await GET(req, {
      params: Promise.resolve({ path: ['..', 'etc', 'passwd'] }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Invalid path');
  });

  it('returns 404 when file does not exist', async () => {
    fs.existsSync.mockReturnValue(false);
    const req = new Request('https://example.com/api/trading-data/2026/week-01.json');
    const res = await GET(req, {
      params: Promise.resolve({ path: ['2026', 'week-01.json'] }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('File not found');
  });

  it('returns 200 and JSON when file exists', async () => {
    const req = new Request('https://example.com/api/trading-data/2026/aggregated/yearly-summary.json');
    const res = await GET(req, {
      params: Promise.resolve({ path: ['2026', 'aggregated', 'yearly-summary.json'] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ week: 1, data: [] });
    expect(fs.readFileSync).toHaveBeenCalled();
  });

  it('returns 500 when readFileSync throws', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const req = new Request('https://example.com/api/trading-data/2026/week-01.json');
    const res = await GET(req, {
      params: Promise.resolve({ path: ['2026', 'week-01.json'] }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
