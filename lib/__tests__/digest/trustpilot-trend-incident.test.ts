/**
 * S10-010: Tests for detectTrustpilotScoreTrendIncident
 */

import { detectTrustpilotScoreTrendIncident } from '@/lib/digest/trustpilot-trend-incident';

// Shared mock state
let mockProfileData: unknown = null;
let mockProfileError: unknown = null;
let mockReportData: unknown[] | null = null;
let mockReportError: unknown = null;

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, _val: string) => {
          if (table === 'firm_profiles') {
            return {
              single: () =>
                Promise.resolve({ data: mockProfileData, error: mockProfileError }),
            };
          }
          // firm_weekly_reports
          return {
            order: () => ({
              limit: () =>
                Promise.resolve({ data: mockReportData, error: mockReportError }),
            }),
          };
        },
      }),
    }),
  }),
}));

const WEEK_START = new Date('2026-03-09T00:00:00Z'); // Monday

function makeReport(avgRating: number, reviewCount = 5) {
  return {
    week_from_date: '2026-03-09',
    report_json: { trustpilot: { avgRating, reviewCount, ratingChange: null } },
  };
}

beforeEach(() => {
  mockProfileData = null;
  mockProfileError = null;
  mockReportData = null;
  mockReportError = null;
});

describe('detectTrustpilotScoreTrendIncident', () => {
  it('returns null when firm_profiles has no overall score', async () => {
    mockProfileData = { trustpilot_overall_score: null };
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns null when firm_profiles is missing', async () => {
    mockProfileData = null;
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns null when fewer than 2 weekly reports', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    mockReportData = [makeReport(3.5)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns null when no weekly reports', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    mockReportData = [];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns null when deviation is within threshold (both weeks)', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    // delta = 4.0 - 4.2 = -0.2, within 0.5
    mockReportData = [makeReport(4.0), makeReport(4.1)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns null when only one week exceeds threshold', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    // current: 4.2 - 3.5 = -0.7 (exceeds), prior: 4.2 - 4.0 = -0.2 (does not)
    mockReportData = [makeReport(3.5), makeReport(4.0)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns null when weeks deviate in opposite directions', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    // current: 4.9 - 4.2 = +0.7, prior: 3.5 - 4.2 = -0.7 — opposite signs
    mockReportData = [makeReport(4.9), makeReport(3.5)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns declining signal when both weeks are below overall by >0.5', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    // current: 3.5 - 4.2 = -0.7, prior: 3.6 - 4.2 = -0.6
    mockReportData = [makeReport(3.5, 8), makeReport(3.6)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('high');
    expect(result!.incident_type).toBe('trustpilot_score_trend');
    expect(result!.title).toMatch(/Declining/);
    expect(result!.summary).toContain('3.5');
    expect(result!.summary).toContain('4.2');
    expect(result!.review_count).toBe(8);
    expect(result!.firm_id).toBe('fundingpips');
  });

  it('returns improving signal when both weeks are above overall by >0.5', async () => {
    mockProfileData = { trustpilot_overall_score: 3.8 };
    // current: 4.5 - 3.8 = +0.7, prior: 4.4 - 3.8 = +0.6
    mockReportData = [makeReport(4.5), makeReport(4.4)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('medium');
    expect(result!.title).toMatch(/Improving/);
    expect(result!.summary).toContain('4.5');
  });

  it('sets correct week_number and year from weekStart', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    mockReportData = [makeReport(3.5), makeReport(3.6)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result!.week_number).toBe(11); // 2026-W11
    expect(result!.year).toBe(2026);
  });

  it('returns null when avgRating is missing from report_json', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    mockReportData = [
      { week_from_date: '2026-03-09', report_json: { trustpilot: {} } },
      { week_from_date: '2026-03-02', report_json: { trustpilot: {} } },
    ];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result).toBeNull();
  });

  it('returns empty review_ids array', async () => {
    mockProfileData = { trustpilot_overall_score: 4.2 };
    mockReportData = [makeReport(3.5), makeReport(3.6)];
    const result = await detectTrustpilotScoreTrendIncident('fundingpips', WEEK_START);
    expect(result!.review_ids).toEqual([]);
  });
});
