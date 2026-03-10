/**
 * TICKET-S10-008: Tests for GET /api/v2/propfirms/[id]/trustpilot-trend
 */

import { GET } from './route';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

const params = Promise.resolve({ id: 'fundednext' });

function makeRequest() {
  return new Request('https://example.com/api/v2/propfirms/fundednext/trustpilot-trend');
}

function setupSupabase({ profile = null, profileError = null, reports = [], reportsError = null } = {}) {
  const mockSingle = jest.fn().mockResolvedValue({ data: profile, error: profileError });
  const mockLimit = jest.fn().mockResolvedValue({ data: reports, error: reportsError });
  const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
  const mockEqReports = jest.fn().mockReturnValue({ order: mockOrder });
  const mockSelectReports = jest.fn().mockReturnValue({ eq: mockEqReports });
  const mockEqProfile = jest.fn().mockReturnValue({ single: mockSingle });
  const mockSelectProfile = jest.fn().mockReturnValue({ eq: mockEqProfile });

  const mockFrom = jest.fn((table) => {
    if (table === 'firm_profiles') return { select: mockSelectProfile };
    if (table === 'firm_weekly_reports') return { select: mockSelectReports };
    return {};
  });

  createClient.mockReturnValue({ from: mockFrom });
  return { mockFrom };
}

describe('GET /api/v2/propfirms/[id]/trustpilot-trend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('returns overall score and weekly trend data', async () => {
    setupSupabase({
      profile: { trustpilot_overall_score: 4.2, trustpilot_overall_review_count: 1840 },
      reports: [
        {
          week_from_date: '2026-02-23',
          week_to_date: '2026-03-01',
          report_json: { trustpilot: { avgRating: 4.1, reviewCount: 12, ratingChange: -0.1 } },
        },
        {
          week_from_date: '2026-02-16',
          week_to_date: '2026-02-22',
          report_json: { trustpilot: { avgRating: 4.3, reviewCount: 8, ratingChange: 0.1 } },
        },
      ],
    });

    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall_score).toBe(4.2);
    expect(body.overall_review_count).toBe(1840);
    expect(body.weeks).toHaveLength(2);
    expect(body.weeks[0]).toEqual({
      week_from: '2026-02-23',
      week_to: '2026-03-01',
      avg_rating: 4.1,
      review_count: 12,
      rating_change: -0.1,
      payout_total: null,
      payout_count: null,
    });
  });

  it('returns nulls when firm has no overall score', async () => {
    setupSupabase({
      profile: { trustpilot_overall_score: null, trustpilot_overall_review_count: null },
      reports: [],
    });

    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall_score).toBeNull();
    expect(body.overall_review_count).toBeNull();
    expect(body.weeks).toEqual([]);
  });

  it('returns empty weeks when no weekly reports exist', async () => {
    setupSupabase({ profile: { trustpilot_overall_score: 4.0, trustpilot_overall_review_count: 500 }, reports: [] });

    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.weeks).toEqual([]);
  });

  it('handles missing trustpilot key in report_json gracefully', async () => {
    setupSupabase({
      profile: null,
      reports: [
        { week_from_date: '2026-02-23', week_to_date: '2026-03-01', report_json: {} },
      ],
    });

    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.weeks[0]).toEqual({
      week_from: '2026-02-23',
      week_to: '2026-03-01',
      avg_rating: null,
      review_count: null,
      rating_change: null,
      payout_total: null,
      payout_count: null,
    });
  });

  it('returns 500 when profile fetch fails with non-PGRST116 error', async () => {
    setupSupabase({ profile: null, profileError: { code: 'PGRST500', message: 'DB error' } });

    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(500);
  });

  it('returns 500 when weekly reports fetch fails', async () => {
    setupSupabase({
      profile: { trustpilot_overall_score: 4.2, trustpilot_overall_review_count: 1840 },
      reportsError: { message: 'Query failed' },
    });

    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(500);
  });

  it('returns 500 when env vars missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const res = await GET(makeRequest(), { params });
    expect(res.status).toBe(500);
  });

  it('treats PGRST116 (firm not found) as null profile, not an error', async () => {
    setupSupabase({ profile: null, profileError: { code: 'PGRST116', message: 'no rows' }, reports: [] });

    const res = await GET(makeRequest(), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall_score).toBeNull();
    expect(body.weeks).toEqual([]);
  });
});
