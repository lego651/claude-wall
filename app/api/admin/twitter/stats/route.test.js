/**
 * Tests for GET /api/admin/twitter/stats
 */
import { GET } from './route';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');

describe('GET /api/admin/twitter/stats', () => {
  let mockSupabase;

  /**
   * Build a chainable Supabase mock where each call to .from(table) can be
   * configured independently via the `fromMap` argument.
   *
   * fromMap keys are table names; values are the resolved response object.
   * Any table not in fromMap falls through to a generic "no data" response.
   */
  function buildMockSupabase({ user = { id: 'user-1' }, isAdmin = true, fromMap = {} } = {}) {
    const makeChain = (response) => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(response),
        single: jest.fn().mockResolvedValue(
          isAdmin ? { data: { is_admin: true } } : { data: { is_admin: false } }
        ),
      };
      return chain;
    };

    const supabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user } }),
      },
      from: jest.fn((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { is_admin: isAdmin },
                }),
              }),
            }),
          };
        }
        if (fromMap[table]) {
          return makeChain(fromMap[table]);
        }
        return makeChain({ data: null, error: null, count: 0 });
      }),
    };
    return supabase;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    const mock = buildMockSupabase({ user: null });
    createClient.mockResolvedValue(mock);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not admin', async () => {
    const mock = buildMockSupabase({ isAdmin: false });
    createClient.mockResolvedValue(mock);
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns structured stats when both runs have data', async () => {
    const mock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
      from: jest.fn((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        if (table === 'cron_last_run') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                last_run_at: '2026-03-10T08:00:00.000Z',
                result_json: {
                  firmInserted: 12,
                  firmSkipped: 3,
                  industryInserted: 7,
                  industrySkipped: 1,
                },
              },
              error: null,
            }),
          };
        }
        if (table === 'twitter_topic_groups') {
          // first call: get latest row; second call: count for week_start
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: {
                created_at: '2026-03-09T06:00:00.000Z',
                week_start: '2026-03-09',
              },
              error: null,
            }),
            // count query returns { count: 3 }
            then: undefined,
            count: 3,
          };
        }
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null }) };
      }),
    };

    // Override twitter_topic_groups to handle both maybeSingle and count calls
    let topicCallCount = 0;
    mock.from = jest.fn((table) => {
      if (table === 'user_profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
            }),
          }),
        };
      }
      if (table === 'cron_last_run') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              last_run_at: '2026-03-10T08:00:00.000Z',
              result_json: { firmInserted: 12, firmSkipped: 3, industryInserted: 7, industrySkipped: 1 },
            },
            error: null,
          }),
        };
      }
      if (table === 'twitter_topic_groups') {
        topicCallCount++;
        if (topicCallCount === 1) {
          // First call: get latest row (maybeSingle)
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { created_at: '2026-03-09T06:00:00.000Z', week_start: '2026-03-09' },
              error: null,
            }),
          };
        }
        // Second call: count for week_start
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ count: 3, error: null }),
        };
      }
      return { select: jest.fn().mockReturnThis() };
    });

    createClient.mockResolvedValue(mock);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.firmRun.lastRunAt).toBe('2026-03-10T08:00:00.000Z');
    expect(body.firmRun.tweetsInserted).toBe(12);
    expect(body.firmRun.tweetsSkipped).toBe(3);
    expect(body.firmRun.errors).toBe(0);

    expect(body.industryRun.lastRunAt).toBe('2026-03-10T08:00:00.000Z');
    expect(body.industryRun.tweetsInserted).toBe(7);
    expect(body.industryRun.tweetsSkipped).toBe(1);
    expect(body.industryRun.errors).toBe(0);

    // health fields
    expect(body.health).toBeDefined();
    expect(['healthy', 'warning', 'critical']).toContain(body.health.runStaleness);
    expect(typeof body.health.hoursAgo).toBe('number');
    expect(['healthy', 'warning']).toContain(body.health.firmActivity);
    expect(['healthy', 'warning']).toContain(body.health.industryActivity);
    expect(['healthy', 'warning', 'critical']).toContain(body.health.overall);
  });

  it('returns null lastRunAt and zero counts when job has never run', async () => {
    const mock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
      from: jest.fn((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        if (table === 'cron_last_run') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'twitter_topic_groups') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      }),
    };

    createClient.mockResolvedValue(mock);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.firmRun.lastRunAt).toBeNull();
    expect(body.firmRun.tweetsInserted).toBe(0);
    expect(body.firmRun.tweetsSkipped).toBe(0);

    expect(body.industryRun.lastRunAt).toBeNull();
    expect(body.industryRun.tweetsInserted).toBe(0);
    expect(body.industryRun.tweetsSkipped).toBe(0);

    expect(body.topicGroups.lastRunAt).toBeNull();
    expect(body.topicGroups.groupsGenerated).toBe(0);
    expect(body.topicGroups.errors).toBe(0);

    // health: never run → critical staleness, both activity = warning (0/0)
    expect(body.health.runStaleness).toBe('critical');
    expect(body.health.hoursAgo).toBeNull();
    expect(body.health.firmActivity).toBe('warning');
    expect(body.health.industryActivity).toBe('warning');
    expect(body.health.overall).toBe('critical');
  });

  it('returns errors=1 for topicGroups when DB query throws', async () => {
    const mock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
      from: jest.fn((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        if (table === 'cron_last_run') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'twitter_topic_groups') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockRejectedValue(new Error('DB down')),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      }),
    };

    createClient.mockResolvedValue(mock);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.topicGroups.errors).toBe(1);
    expect(body.topicGroups.lastRunAt).toBeNull();
    expect(body.topicGroups.groupsGenerated).toBe(0);
  });

  it('returns topicGroups error=1 when DB returns error object', async () => {
    const mock = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
      from: jest.fn((table) => {
        if (table === 'user_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { is_admin: true } }),
              }),
            }),
          };
        }
        if (table === 'cron_last_run') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        if (table === 'twitter_topic_groups') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'table does not exist' } }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      }),
    };

    createClient.mockResolvedValue(mock);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.topicGroups.errors).toBe(1);
  });
});
