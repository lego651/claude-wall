import { POST } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };
const IDS = ['acct-1', 'acct-2', 'acct-3'];

function mockClient({ user = USER, accounts = IDS.map((id) => ({ id })), updateError = null } = {}) {
  const updateChain = {
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
  updateChain.eq.mockReturnValue({ ...updateChain, then: undefined });

  const inChain = {
    in: jest.fn().mockResolvedValue({ data: accounts, error: null }),
  };

  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: jest.fn((table) => {
      if (table === 'trade_accounts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: accounts, error: null }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: updateError }),
            }),
          }),
        };
      }
      return {};
    }),
  };
  createClient.mockResolvedValue(client);
  return client;
}

function makeRequest(body) {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe('POST /api/trade-accounts/reorder', () => {
  it('returns 401 when not authenticated', async () => {
    const client = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      from: jest.fn(),
    };
    createClient.mockResolvedValue(client);
    const res = await POST(makeRequest({ ids: IDS }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const client = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: USER } }) },
      from: jest.fn(),
    };
    createClient.mockResolvedValue(client);
    const req = { json: jest.fn().mockRejectedValue(new Error('bad json')) };
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when ids is not an array', async () => {
    mockClient();
    const res = await POST(makeRequest({ ids: 'not-an-array' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when ids is empty', async () => {
    mockClient();
    const res = await POST(makeRequest({ ids: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when an id does not belong to the user', async () => {
    mockClient({ accounts: [{ id: 'acct-1' }, { id: 'acct-2' }] }); // acct-3 missing
    const res = await POST(makeRequest({ ids: IDS }));
    expect(res.status).toBe(404);
  });

  it('returns 200 and updates sort_order on success', async () => {
    mockClient({ accounts: IDS.map((id) => ({ id })) });
    const res = await POST(makeRequest({ ids: IDS }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
