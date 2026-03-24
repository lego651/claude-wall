import { PATCH, DELETE } from './route';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
const { createClient } = require('@/lib/supabase/server');

const USER = { id: 'user-123' };
const ACCOUNT = { id: 'acct-1', is_default: false, name: 'Funded A', pnl_unit: 'R', created_at: '2026-01-01' };
const DEFAULT_ACCOUNT = { ...ACCOUNT, is_default: true, name: 'Default' };

function makeParams(id = 'acct-1') {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body) {
  return { json: () => Promise.resolve(body) };
}

function mockClient({ user = USER, ownershipResult = { data: ACCOUNT, error: null }, updateResult = { data: ACCOUNT, error: null }, deleteError = null } = {}) {
  const singleFn = jest.fn();
  const updateFn = jest.fn().mockReturnThis();
  const deleteFn = jest.fn().mockReturnThis();
  const selectFn = jest.fn().mockReturnThis();
  const eqFn = jest.fn().mockReturnThis();

  const fromImpl = jest.fn().mockReturnValue({
    select: selectFn,
    eq: eqFn,
    update: updateFn,
    delete: deleteFn,
    single: singleFn,
  });

  // First single call = ownership check, second = update result
  singleFn
    .mockResolvedValueOnce(ownershipResult)
    .mockResolvedValue(updateResult);

  // Delete resolves
  deleteFn.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: deleteError }) });

  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: fromImpl,
  };
  createClient.mockResolvedValue(client);
  return client;
}

describe('PATCH /api/trade-accounts/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null });
    const res = await PATCH(makeRequest({ name: 'New Name' }), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 400 if pnl_unit in body', async () => {
    mockClient();
    const res = await PATCH(makeRequest({ pnl_unit: 'R' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/P&L unit/);
  });

  it('returns 400 for invalid JSON', async () => {
    mockClient();
    const res = await PATCH({ json: () => Promise.reject(new SyntaxError('bad')) }, makeParams());
    expect(res.status).toBe(400);
  });

  it('returns 404 if account not found', async () => {
    mockClient({ ownershipResult: { data: null, error: null } });
    const res = await PATCH(makeRequest({ name: 'X' }), makeParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('renames account', async () => {
    const updated = { ...ACCOUNT, name: 'Renamed' };
    mockClient({ updateResult: { data: updated, error: null } });
    const res = await PATCH(makeRequest({ name: 'Renamed' }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe('Renamed');
  });

  it('returns 400 for name too long', async () => {
    mockClient();
    const res = await PATCH(makeRequest({ name: 'x'.repeat(51) }), makeParams());
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty name', async () => {
    mockClient();
    const res = await PATCH(makeRequest({ name: '  ' }), makeParams());
    expect(res.status).toBe(400);
  });

  it('sets account as default (unsets others first)', async () => {
    const updated = { ...ACCOUNT, is_default: true };

    const singleFn = jest.fn()
      .mockResolvedValueOnce({ data: ACCOUNT, error: null })
      .mockResolvedValue({ data: updated, error: null });

    const updateFn = jest.fn().mockReturnThis();
    const eqFn = jest.fn().mockReturnThis();
    const selectFn = jest.fn().mockReturnThis();

    const fromImpl = jest.fn().mockReturnValue({
      select: selectFn,
      eq: eqFn,
      update: updateFn,
      single: singleFn,
    });

    updateFn.mockReturnValue({
      eq: jest.fn().mockReturnThis(),
      select: selectFn,
      single: singleFn,
    });

    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: USER } }) },
      from: fromImpl,
    });

    const res = await PATCH(makeRequest({ is_default: true }), makeParams());
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/trade-accounts/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 if unauthenticated', async () => {
    mockClient({ user: null });
    const res = await DELETE(makeRequest({}), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 if account not found', async () => {
    mockClient({ ownershipResult: { data: null, error: null } });
    const res = await DELETE(makeRequest({}), makeParams('nonexistent'));
    expect(res.status).toBe(404);
  });

  it('returns 400 if trying to delete default account', async () => {
    mockClient({ ownershipResult: { data: DEFAULT_ACCOUNT, error: null } });
    const res = await DELETE(makeRequest({}), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/default/i);
  });

  it('deletes non-default account', async () => {
    const singleFn = jest.fn().mockResolvedValue({ data: ACCOUNT, error: null });
    const eqFn = jest.fn().mockReturnThis();
    const selectFn = jest.fn().mockReturnThis();
    const deleteFrom = {
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: selectFn,
      eq: eqFn,
      single: singleFn,
    };
    createClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: USER } }) },
      from: jest.fn().mockReturnValue(deleteFrom),
    });

    const res = await DELETE(makeRequest({}), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
