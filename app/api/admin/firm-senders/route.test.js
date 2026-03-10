/**
 * Tests for GET/POST /api/admin/firm-senders
 */

import { GET, POST } from './route';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/supabase/service');

function makeRequest(body) {
  return new Request('https://example.com/api/admin/firm-senders', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeServerSupabase({ isAdmin = true, user = { id: 'user-1' } } = {}) {
  const single = jest.fn().mockResolvedValue({ data: { is_admin: isAdmin }, error: null });
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  const getUser = jest.fn().mockResolvedValue({ data: { user } });
  return { auth: { getUser }, from: jest.fn().mockReturnValue({ select }) };
}

function makeServiceSupabase({ rows = [], insertedRow = null, firmExists = true, dbError = null } = {}) {
  const orderChain = { data: rows, error: dbError };
  const order2Chain = { ...orderChain };
  order2Chain.order = jest.fn().mockReturnValue(orderChain);
  const selectListChain = { order: jest.fn().mockReturnValue(order2Chain) };

  const singleInsert = jest.fn().mockResolvedValue({ data: insertedRow, error: dbError });
  const selectInsert = jest.fn().mockReturnValue({ single: singleInsert });
  const insertChain = { select: selectInsert };
  const insert = jest.fn().mockReturnValue(insertChain);

  const singleFirm = jest.fn().mockResolvedValue({ data: firmExists ? { id: 'fundingpips' } : null, error: null });
  const eqFirm = jest.fn().mockReturnValue({ single: singleFirm });
  const selectFirm = jest.fn().mockReturnValue({ eq: eqFirm });

  const from = jest.fn().mockImplementation((table) => {
    if (table === 'firm_profiles') return { select: selectFirm };
    if (table === 'firm_email_senders') return { select: jest.fn().mockReturnValue(selectListChain), insert };
    return {};
  });

  return { from };
}

describe('GET /api/admin/firm-senders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    createClient.mockResolvedValue(makeServerSupabase({ user: null }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    createClient.mockResolvedValue(makeServerSupabase({ isAdmin: false }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 with sender list', async () => {
    const rows = [{ id: 1, firm_id: 'fundingpips', sender_email: 'hello@fundingpips.com', sender_domain: null, created_at: '2026-01-01' }];
    createClient.mockResolvedValue(makeServerSupabase());
    createServiceClient.mockReturnValue(makeServiceSupabase({ rows }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.senders).toEqual(rows);
  });

  it('returns 500 on DB error', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    createServiceClient.mockReturnValue(makeServiceSupabase({ dbError: { message: 'DB error' } }));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/firm-senders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    createClient.mockResolvedValue(makeServerSupabase({ user: null }));
    const res = await POST(makeRequest({ firm_id: 'fundingpips', sender_domain: 'fundingpips.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when firm_id missing', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    const res = await POST(makeRequest({ sender_domain: 'fundingpips.com' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when neither sender_email nor sender_domain provided', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    const res = await POST(makeRequest({ firm_id: 'fundingpips' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when firm not found', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    createServiceClient.mockReturnValue(makeServiceSupabase({ firmExists: false }));
    const res = await POST(makeRequest({ firm_id: 'unknown', sender_domain: 'unknown.com' }));
    expect(res.status).toBe(404);
  });

  it('returns 201 with inserted sender', async () => {
    const inserted = { id: 99, firm_id: 'fundingpips', sender_domain: 'new.com', sender_email: null, created_at: '2026-01-01' };
    createClient.mockResolvedValue(makeServerSupabase());
    createServiceClient.mockReturnValue(makeServiceSupabase({ insertedRow: inserted }));

    const res = await POST(makeRequest({ firm_id: 'fundingpips', sender_domain: 'new.com' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sender).toEqual(inserted);
  });

  it('returns 409 on duplicate (unique constraint violation)', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    createServiceClient.mockReturnValue(makeServiceSupabase({ dbError: { code: '23505', message: 'unique' } }));

    const res = await POST(makeRequest({ firm_id: 'fundingpips', sender_domain: 'fundingpips.com' }));
    expect(res.status).toBe(409);
  });

  it('returns 400 on invalid JSON body', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    const req = new Request('https://example.com/api/admin/firm-senders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
