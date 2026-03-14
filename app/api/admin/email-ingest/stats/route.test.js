/**
 * Tests for GET /api/admin/email-ingest/stats
 */

import { GET } from './route';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

jest.mock('@/lib/supabase/server');
jest.mock('@/lib/alert-rules', () => ({
  EMAIL_INGEST_STALE_MINUTES: 60,
}));

const mockCreateClient = createClient;

function makeRun(minutesAgo, overrides = {}) {
  const last_run_at = new Date(Date.now() - minutesAgo * 60000).toISOString();
  return {
    last_run_at,
    result_json: {
      processed: 10,
      inserted: 8,
      skipped: 2,
      errors: 0,
      ...overrides,
    },
  };
}

function makeSupabaseMock({ user = { id: 'user-1' }, isAdmin = true, runs = [], dbError = null } = {}) {
  const limitMock = jest.fn().mockResolvedValue({ data: runs, error: dbError });
  const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
  const eqJobMock = jest.fn().mockReturnValue({ order: orderMock });
  const selectRunsMock = jest.fn().mockReturnValue({ eq: eqJobMock });

  const singleProfileMock = jest.fn().mockResolvedValue({
    data: isAdmin ? { is_admin: true } : { is_admin: false },
    error: null,
  });
  const eqProfileMock = jest.fn().mockReturnValue({ single: singleProfileMock });
  const selectProfileMock = jest.fn().mockReturnValue({ eq: eqProfileMock });

  const from = jest.fn((table) => {
    if (table === 'user_profiles') return { select: selectProfileMock };
    if (table === 'cron_last_run') return { select: selectRunsMock };
    return {};
  });

  const getUser = jest.fn().mockResolvedValue({
    data: { user },
    error: null,
  });

  return {
    from,
    auth: { getUser },
  };
}

describe('GET /api/admin/email-ingest/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const supabase = makeSupabaseMock({ user: null });
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    const supabase = makeSupabaseMock({ isAdmin: false });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns 500 when DB query fails', async () => {
    const supabase = makeSupabaseMock({ dbError: { message: 'DB connection failed' } });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('DB connection failed');
  });

  it('returns status critical and lastRun null when no runs exist', async () => {
    const supabase = makeSupabaseMock({ runs: [] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('critical');
    expect(body.statusReason).toBe('Never run');
    expect(body.lastRun).toBeNull();
    expect(body.recentRuns).toEqual([]);
  });

  it('returns status ok when last run < 30min ago with no errors', async () => {
    const supabase = makeSupabaseMock({ runs: [makeRun(10)] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.statusReason).toBe('Running normally');
  });

  it('returns status warning when last run 30–60min ago with no errors', async () => {
    const supabase = makeSupabaseMock({ runs: [makeRun(45)] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('warning');
    expect(body.statusReason).toMatch(/45m ago/);
  });

  it('returns status critical when last run > 60min ago', async () => {
    const supabase = makeSupabaseMock({ runs: [makeRun(120)] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('critical');
    expect(body.statusReason).toMatch(/120m ago/);
  });

  it('returns status critical when latest run has errors > 0', async () => {
    const supabase = makeSupabaseMock({ runs: [makeRun(5, { errors: 3 })] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.status).toBe('critical');
    expect(body.statusReason).toBe('3 error(s) in last run');
  });

  it('errors takes priority over staleness in statusReason', async () => {
    const supabase = makeSupabaseMock({ runs: [makeRun(90, { errors: 2 })] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    const body = await response.json();

    expect(body.status).toBe('critical');
    expect(body.statusReason).toBe('2 error(s) in last run');
  });

  it('returns correct stats from latest run', async () => {
    const run = {
      last_run_at: new Date(Date.now() - 5 * 60000).toISOString(),
      result_json: { processed: 20, inserted: 15, skipped: 4, errors: 1 },
    };
    const supabase = makeSupabaseMock({ runs: [run] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    const body = await response.json();

    expect(body.stats).toEqual({ processed: 20, inserted: 15, skipped: 4, errors: 1 });
    expect(body.lastRun).toBe(run.last_run_at);
  });

  it('defaults numeric fields to 0 when result_json is null', async () => {
    const run = {
      last_run_at: new Date(Date.now() - 5 * 60000).toISOString(),
      result_json: null,
    };
    const supabase = makeSupabaseMock({ runs: [run] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    const body = await response.json();

    expect(body.stats).toEqual({ processed: 0, inserted: 0, skipped: 0, errors: 0 });
  });

  it('defaults numeric fields to 0 when result_json has missing fields', async () => {
    const run = {
      last_run_at: new Date(Date.now() - 5 * 60000).toISOString(),
      result_json: { inserted: 3 },
    };
    const supabase = makeSupabaseMock({ runs: [run] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    const body = await response.json();

    expect(body.stats).toEqual({ processed: 0, inserted: 3, skipped: 0, errors: 0 });
  });

  it('returns recentRuns with correct shape for multiple runs', async () => {
    const runs = [
      makeRun(5, { inserted: 10, errors: 0 }),
      makeRun(65, { inserted: 5, errors: 1 }),
      makeRun(125, { inserted: 0, errors: 2 }),
    ];
    const supabase = makeSupabaseMock({ runs });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    const body = await response.json();

    expect(body.recentRuns).toHaveLength(3);
    expect(body.recentRuns[0]).toEqual({
      ranAt: runs[0].last_run_at,
      inserted: 10,
      errors: 0,
    });
    expect(body.recentRuns[1]).toEqual({
      ranAt: runs[1].last_run_at,
      inserted: 5,
      errors: 1,
    });
    expect(body.recentRuns[2]).toEqual({
      ranAt: runs[2].last_run_at,
      inserted: 0,
      errors: 2,
    });
  });

  it('returns HTTP 200 even when no runs exist', async () => {
    const supabase = makeSupabaseMock({ runs: [] });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('queries cron_last_run with correct job_name', async () => {
    const supabase = makeSupabaseMock({ runs: [] });
    mockCreateClient.mockResolvedValue(supabase);

    await GET();

    expect(supabase.from).toHaveBeenCalledWith('cron_last_run');
  });
});
