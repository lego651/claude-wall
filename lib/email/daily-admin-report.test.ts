/**
 * Tests for lib/email/daily-admin-report.ts
 * S12-006
 */

import { renderReportHtml, fetchReportData } from './daily-admin-report';
import type { ReportData, PipelineHealth } from './daily-admin-report';

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockImplementation(() => {
    throw new Error('ENOENT');
  }),
}));

import fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePipeline(overrides: Partial<PipelineHealth> = {}): PipelineHealth {
  return {
    jobName: 'test_job',
    displayName: 'Test Job',
    lastRunAt: new Date(Date.now() - 1000).toISOString(),
    status: 'ok',
    stats: {},
    ...overrides,
  };
}

function makeData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    pipelines: [makePipeline()],
    zeroPayoutFirms: [],
    staleClassifierBacklog: 0,
    newContent: { total: 0, byType: {}, firmNames: [] },
    payoutSync: { totalFirms: 10, syncedToday: 10, critical: [] },
    generatedAt: '2026-03-13T08:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// renderReportHtml — pure function tests (no DB)
// ---------------------------------------------------------------------------

describe('renderReportHtml', () => {
  it('returns a valid HTML document', () => {
    const html = renderReportHtml(makeData());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Daily Admin Report');
    expect(html).toContain('2026-03-13 UTC');
  });

  it('shows "All systems nominal" when all pipelines are OK and no alerts', () => {
    const html = renderReportHtml(makeData());
    expect(html).toContain('All systems nominal');
  });

  it('shows red CRITICAL badge for a critical pipeline', () => {
    const data = makeData({
      pipelines: [makePipeline({ status: 'critical', displayName: 'Daily 1: Scrape' })],
    });
    const html = renderReportHtml(data);
    expect(html).toContain('CRITICAL');
    expect(html).toContain('#dc2626');
  });

  it('shows critical pipeline in Data Alerts section', () => {
    const data = makeData({
      pipelines: [makePipeline({ status: 'critical', displayName: 'Daily 1: Scrape' })],
    });
    const html = renderReportHtml(data);
    expect(html).toContain('Daily 1: Scrape');
    expect(html).toContain('pipeline is critical');
  });

  it('shows amber WARNING badge for a warning pipeline', () => {
    const data = makeData({
      pipelines: [makePipeline({ status: 'warning', displayName: 'Daily 2: Classify' })],
    });
    const html = renderReportHtml(data);
    expect(html).toContain('WARNING');
    expect(html).toContain('#d97706');
  });

  it('shows warning pipeline in Data Alerts section', () => {
    const data = makeData({
      pipelines: [makePipeline({ status: 'warning', displayName: 'Daily 2: Classify' })],
    });
    const html = renderReportHtml(data);
    expect(html).toContain('Daily 2: Classify');
    expect(html).toContain('pipeline is warning');
  });

  it('shows content summary when new content exists', () => {
    const data = makeData({
      newContent: {
        total: 5,
        byType: { company_news: 3, rule_change: 2 },
        firmNames: ['FirmA', 'FirmB'],
      },
    });
    const html = renderReportHtml(data);
    expect(html).toContain('Total:</strong> 5');
    expect(html).toContain('company_news: 3');
    expect(html).toContain('rule_change: 2');
    expect(html).toContain('FirmA');
    expect(html).toContain('FirmB');
  });

  it('shows "No new content ingested" when content total is 0', () => {
    const html = renderReportHtml(makeData());
    expect(html).toContain('No new content ingested');
  });

  it('shows zero-payout firms in Data Alerts section', () => {
    const data = makeData({
      zeroPayoutFirms: ['Alpha Firm', 'Beta Firm'],
    });
    const html = renderReportHtml(data);
    expect(html).toContain('Alpha Firm');
    expect(html).toContain('Beta Firm');
    expect(html).toContain('Zero payouts (30d)');
  });

  it('does not show "All systems nominal" when zero-payout firms present', () => {
    const data = makeData({ zeroPayoutFirms: ['Some Firm'] });
    const html = renderReportHtml(data);
    expect(html).not.toContain('All systems nominal');
  });

  it('shows classifier backlog alert when above threshold', () => {
    const data = makeData({ staleClassifierBacklog: 600 });
    const html = renderReportHtml(data);
    expect(html).toContain('Classifier backlog');
    expect(html).toContain('600');
  });

  it('does NOT show classifier backlog alert when at or below threshold (500)', () => {
    const data = makeData({ staleClassifierBacklog: 500 });
    const html = renderReportHtml(data);
    expect(html).not.toContain('Classifier backlog');
  });

  it('includes admin dashboard link', () => {
    const html = renderReportHtml(makeData());
    expect(html).toContain('claude-wall.vercel.app/admin/dashboard');
  });

  it('shows OK badge when all firms synced today', () => {
    const data = makeData({ payoutSync: { totalFirms: 5, syncedToday: 5, critical: [] } });
    const html = renderReportHtml(data);
    expect(html).toContain('Payout Sync');
    expect(html).toContain('All 5 firms synced today');
  });

  it('shows CRITICAL badge when some firms not synced today', () => {
    const data = makeData({
      payoutSync: { totalFirms: 5, syncedToday: 3, critical: ['FirmA', 'FirmB'] },
    });
    const html = renderReportHtml(data);
    expect(html).toContain('3/5 synced today');
    expect(html).toContain('FirmA');
    expect(html).toContain('FirmB');
  });

  it('renders pipeline stats when present', () => {
    const data = makeData({
      pipelines: [
        makePipeline({
          stats: { processed: 42, errors: 0 },
          displayName: 'Email Ingest',
        }),
      ],
    });
    const html = renderReportHtml(data);
    expect(html).toContain('processed: 42');
  });

  it('renders "Never" for pipelines with null lastRunAt', () => {
    const data = makeData({
      pipelines: [makePipeline({ lastRunAt: null, status: 'critical' })],
    });
    const html = renderReportHtml(data);
    expect(html).toContain('Never');
  });
});

// ---------------------------------------------------------------------------
// fetchReportData — mocked Supabase service client
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: jest.fn(),
}));

import { createServiceClient } from '@/lib/supabase/service';

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>;

function buildMockSupabase(overrides: {
  cronRows?: unknown[];
  oldFirms?: unknown[];
  payoutRows?: unknown[];
  unclassifiedCount?: number | null;
  contentRows?: unknown[];
  firmProfiles?: unknown[];
} = {}) {
  const {
    cronRows = [],
    oldFirms = [],
    payoutRows = [],
    unclassifiedCount = 0,
    contentRows = [],
    firmProfiles = [],
  } = overrides;

  const mockFrom = jest.fn().mockImplementation((table: string) => {
    if (table === 'cron_last_run') {
      return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: cronRows, error: null }),
      };
    }
    if (table === 'firm_profiles') {
      return {
        select: jest.fn().mockReturnThis(),
        lt: jest.fn().mockResolvedValue({ data: oldFirms, error: null }),
        in: jest.fn().mockResolvedValue({ data: firmProfiles, error: null }),
      };
    }
    if (table === 'firm_recent_payouts') {
      return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: payoutRows, error: null }),
      };
    }
    if (table === 'firm_trustpilot_reviews') {
      return {
        select: jest.fn().mockReturnThis(),
        is: jest.fn().mockResolvedValue({ count: unclassifiedCount, error: null }),
      };
    }
    if (table === 'firm_content_items') {
      return {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ data: contentRows, error: null }),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
      is: jest.fn().mockResolvedValue({ count: 0, error: null }),
      gte: jest.fn().mockResolvedValue({ data: [], error: null }),
      lt: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });

  return { from: mockFrom } as unknown as ReturnType<typeof createServiceClient>;
}

describe('fetchReportData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no _sync.json files present
    (fs.readFileSync as jest.Mock).mockImplementation(() => { throw new Error('ENOENT'); });
  });

  it('returns a ReportData object with all required fields', async () => {
    mockCreateServiceClient.mockReturnValue(buildMockSupabase());
    const data = await fetchReportData();
    expect(data).toHaveProperty('pipelines');
    expect(data).toHaveProperty('zeroPayoutFirms');
    expect(data).toHaveProperty('staleClassifierBacklog');
    expect(data).toHaveProperty('newContent');
    expect(data).toHaveProperty('payoutSync');
    expect(data).toHaveProperty('generatedAt');
  });

  it('returns 4 pipelines matching the defined jobs', async () => {
    mockCreateServiceClient.mockReturnValue(buildMockSupabase());
    const data = await fetchReportData();
    expect(data.pipelines).toHaveLength(4);
    const displayNames = data.pipelines.map((p) => p.displayName);
    expect(displayNames).toContain('Daily 1: Scrape');
    expect(displayNames).toContain('Daily 2: Classify');
    expect(displayNames).toContain('Daily 3: Incidents');
    expect(displayNames).toContain('Email Ingest');
  });

  it('marks pipeline as CRITICAL when last_run_at is null', async () => {
    const cronRows = [{ job_name: 'trustpilot_scraper', last_run_at: null, result_json: null }];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ cronRows }));
    const data = await fetchReportData();
    const scraper = data.pipelines.find((p) => p.jobName === 'trustpilot_scraper');
    expect(scraper?.status).toBe('critical');
    expect(scraper?.lastRunAt).toBeNull();
  });

  it('marks pipeline as CRITICAL when last_run_at is >25 hours ago', async () => {
    const oldTs = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
    const cronRows = [{ job_name: 'classify_reviews', last_run_at: oldTs, result_json: null }];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ cronRows }));
    const data = await fetchReportData();
    const classifier = data.pipelines.find((p) => p.jobName === 'classify_reviews');
    expect(classifier?.status).toBe('critical');
  });

  it('marks pipeline as CRITICAL when result_json has errors > 0', async () => {
    const recentTs = new Date(Date.now() - 1000).toISOString();
    const cronRows = [
      { job_name: 'incident_detector', last_run_at: recentTs, result_json: { errors: 5 } },
    ];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ cronRows }));
    const data = await fetchReportData();
    const incident = data.pipelines.find((p) => p.jobName === 'incident_detector');
    expect(incident?.status).toBe('critical');
  });

  it('marks pipeline as OK when run is recent and no errors', async () => {
    const recentTs = new Date(Date.now() - 1000).toISOString();
    const cronRows = [
      { job_name: 'ingest-firm-emails', last_run_at: recentTs, result_json: { processed: 10, errors: 0 } },
    ];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ cronRows }));
    const data = await fetchReportData();
    const emailIngest = data.pipelines.find((p) => p.jobName === 'ingest-firm-emails');
    expect(emailIngest?.status).toBe('ok');
    expect(emailIngest?.stats).toEqual({ processed: 10, errors: 0 });
  });

  it('marks pipeline as WARNING when last_run_at is >12h but <25h', async () => {
    const ts = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
    const cronRows = [
      { job_name: 'trustpilot_scraper', last_run_at: ts, result_json: null },
    ];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ cronRows }));
    const data = await fetchReportData();
    const scraper = data.pipelines.find((p) => p.jobName === 'trustpilot_scraper');
    expect(scraper?.status).toBe('warning');
  });

  it('returns correct staleClassifierBacklog count', async () => {
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ unclassifiedCount: 123 }));
    const data = await fetchReportData();
    expect(data.staleClassifierBacklog).toBe(123);
  });

  it('returns 0 staleClassifierBacklog when count is null', async () => {
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ unclassifiedCount: null }));
    const data = await fetchReportData();
    expect(data.staleClassifierBacklog).toBe(0);
  });

  it('returns zero-payout firms when they have no recent payouts', async () => {
    const oldFirms = [
      { id: 'firm-1', name: 'Firm Alpha' },
      { id: 'firm-2', name: 'Firm Beta' },
    ];
    // payoutRows only covers firm-1
    const payoutRows = [{ firm_id: 'firm-1' }];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ oldFirms, payoutRows }));
    const data = await fetchReportData();
    expect(data.zeroPayoutFirms).toContain('Firm Beta');
    expect(data.zeroPayoutFirms).not.toContain('Firm Alpha');
  });

  it('returns empty zeroPayoutFirms when all firms have payouts', async () => {
    const oldFirms = [{ id: 'firm-1', name: 'Firm Alpha' }];
    const payoutRows = [{ firm_id: 'firm-1' }];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ oldFirms, payoutRows }));
    const data = await fetchReportData();
    expect(data.zeroPayoutFirms).toHaveLength(0);
  });

  it('returns correct new content counts', async () => {
    const contentRows = [
      { content_type: 'company_news', firm_id: 'firm-1' },
      { content_type: 'company_news', firm_id: 'firm-2' },
      { content_type: 'rule_change', firm_id: 'firm-1' },
    ];
    const firmProfiles = [
      { id: 'firm-1', name: 'Firm Alpha' },
      { id: 'firm-2', name: 'Firm Beta' },
    ];
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ contentRows, firmProfiles }));
    const data = await fetchReportData();
    expect(data.newContent.total).toBe(3);
    expect(data.newContent.byType.company_news).toBe(2);
    expect(data.newContent.byType.rule_change).toBe(1);
    expect(data.newContent.firmNames).toContain('Firm Alpha');
    expect(data.newContent.firmNames).toContain('Firm Beta');
  });

  it('returns empty content when no items in last 24h', async () => {
    mockCreateServiceClient.mockReturnValue(buildMockSupabase({ contentRows: [] }));
    const data = await fetchReportData();
    expect(data.newContent.total).toBe(0);
    expect(data.newContent.firmNames).toHaveLength(0);
  });

  it('generatedAt is a valid ISO string', async () => {
    mockCreateServiceClient.mockReturnValue(buildMockSupabase());
    const data = await fetchReportData();
    expect(() => new Date(data.generatedAt)).not.toThrow();
    expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('payoutSync reports 0 synced when no _sync.json files exist', async () => {
    mockCreateServiceClient.mockReturnValue(buildMockSupabase());
    const data = await fetchReportData();
    expect(data.payoutSync.syncedToday).toBe(0);
    expect(data.payoutSync.totalFirms).toBe(0); // no firms in mock
  });
});
