/**
 * Tests for GET /api/v2/propfirms/[id]/content
 */

import { GET } from './route';
import { createClient } from '@supabase/supabase-js';
import { validateOrigin, isRateLimited } from '@/lib/apiSecurity';
import { withQueryGuard } from '@/lib/supabaseQuery';

jest.mock('@supabase/supabase-js');
jest.mock('@/lib/apiSecurity');
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/middleware/requestId', () => ({
  getRequestId: () => 'test-req-id',
  setRequestIdHeader: jest.fn(),
}));
jest.mock('@/lib/supabaseQuery', () => ({
  withQueryGuard: jest.fn(),
}));

const mockWithQueryGuard = withQueryGuard;

const SAMPLE_ITEMS = [
  {
    id: 1,
    content_type: 'company_news',
    title: 'Test',
    ai_summary: 'Summary',
    ai_category: 'company_news',
    ai_confidence: 0.9,
    ai_tags: ['tag'],
    source_type: 'firm_email',
    source_url: null,
    content_date: '2026-03-10',
    published_at: '2026-03-10T12:00:00Z',
  },
];

function createRequest(search = '') {
  return new Request(`https://example.com/api/v2/propfirms/fundingpips/content${search}`, {
    headers: { Origin: 'http://localhost:3000' },
  });
}

function makeQueryChain() {
  const chain = {};
  ['select', 'eq', 'order', 'limit', 'gte'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  return chain;
}

describe('GET /api/v2/propfirms/[id]/content', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    validateOrigin.mockReturnValue({ ok: true, headers: {} });
    isRateLimited.mockReturnValue({ limited: false, retryAfterMs: 60_000 });

    const chain = makeQueryChain();
    createClient.mockReturnValue({ from: jest.fn().mockReturnValue(chain) });

    mockWithQueryGuard.mockResolvedValue({ data: SAMPLE_ITEMS, error: null });
  });

  it('returns 403 for forbidden origin', async () => {
    validateOrigin.mockReturnValue({ ok: false, headers: {} });

    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(403);
    expect(mockWithQueryGuard).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    isRateLimited.mockReturnValue({ limited: true, retryAfterMs: 5000 });

    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Rate limit exceeded');
  });

  it('returns 400 for invalid type param', async () => {
    const res = await GET(createRequest('?type=badvalue'), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid type/);
  });

  it('returns 200 with items on success', async () => {
    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual(SAMPLE_ITEMS);
  });

  it('returns empty array when no results', async () => {
    mockWithQueryGuard.mockResolvedValue({ data: [], error: null });

    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    mockWithQueryGuard.mockResolvedValue({ data: null, error: null });

    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('returns 500 on DB error', async () => {
    mockWithQueryGuard.mockResolvedValue({ data: null, error: { message: 'DB failure' } });

    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(500);
  });

  it('returns 500 with "Database timeout" on query timeout', async () => {
    mockWithQueryGuard.mockRejectedValue(new Error('Query timeout'));

    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Database timeout');
  });

  it('returns 500 with error message on other thrown errors', async () => {
    mockWithQueryGuard.mockRejectedValue(new Error('Connection refused'));

    const res = await GET(createRequest(), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Connection refused');
  });

  it('accepts valid type param', async () => {
    const res = await GET(createRequest('?type=promotion'), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(200);
  });

  it('accepts days param', async () => {
    const res = await GET(createRequest('?days=30'), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(200);
  });

  it('caps limit at 200', async () => {
    const res = await GET(createRequest('?limit=9999'), { params: Promise.resolve({ id: 'fundingpips' }) });
    expect(res.status).toBe(200);
  });
});
