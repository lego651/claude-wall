/**
 * Tests for DELETE /api/admin/firm-senders/[id]
 */

import { DELETE } from './route';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/supabase/service');

function makeServerSupabase({ isAdmin = true, user = { id: 'user-1' } } = {}) {
  const single = jest.fn().mockResolvedValue({ data: { is_admin: isAdmin }, error: null });
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  const getUser = jest.fn().mockResolvedValue({ data: { user } });
  return { auth: { getUser }, from: jest.fn().mockReturnValue({ select }) };
}

function makeServiceSupabase({ dbError = null } = {}) {
  const eqChain = { error: dbError };
  const deleteChain = { eq: jest.fn().mockReturnValue(eqChain) };
  return { from: jest.fn().mockReturnValue({ delete: jest.fn().mockReturnValue(deleteChain) }) };
}

const PARAMS = Promise.resolve({ id: '42' });

describe('DELETE /api/admin/firm-senders/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    createClient.mockResolvedValue(makeServerSupabase({ user: null }));
    const res = await DELETE(new Request('https://example.com'), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    createClient.mockResolvedValue(makeServerSupabase({ isAdmin: false }));
    const res = await DELETE(new Request('https://example.com'), { params: PARAMS });
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful delete', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    createServiceClient.mockReturnValue(makeServiceSupabase());

    const res = await DELETE(new Request('https://example.com'), { params: PARAMS });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 500 on DB error', async () => {
    createClient.mockResolvedValue(makeServerSupabase());
    createServiceClient.mockReturnValue(makeServiceSupabase({ dbError: { message: 'DB failure' } }));

    const res = await DELETE(new Request('https://example.com'), { params: PARAMS });
    expect(res.status).toBe(500);
  });
});
