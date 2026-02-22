/**
 * Tests for buildWeeklyDigestHtml (lib/email/weekly-digest-html.ts)
 */
import {
  buildWeeklyDigestHtml,
  type DigestReportInput,
  type DigestEmailOptions,
} from '../weekly-digest-html';

const baseOptions: DigestEmailOptions = {
  weekStart: '2025-01-06',
  weekEnd: '2025-01-12',
  manageSubscriptionsUrl: 'https://example.com/settings',
  unsubscribeUrl: 'https://example.com/unsubscribe',
  baseUrl: 'https://example.com',
};

const baseReport: DigestReportInput = {
  firmId: 'firm-a',
  firmName: 'Firm A',
  weekStart: '2025-01-06',
  weekEnd: '2025-01-12',
  payouts: {
    total: 1000,
    count: 5,
    largest: 500,
    avgPayout: 200,
    changeVsLastWeek: null,
  },
  trustpilot: {
    avgRating: 4.2,
    ratingChange: null,
    reviewCount: 10,
    sentiment: { positive: 6, neutral: 3, negative: 1 },
  },
  incidents: [],
  ourTake: 'Solid week.',
};

describe('buildWeeklyDigestHtml', () => {
  it('returns full HTML with header and footer for empty reports', () => {
    const html = buildWeeklyDigestHtml([], baseOptions);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Your Weekly Digest');
    expect(html).toContain('Week of 2025-01-06 – 2025-01-12');
    expect(html).toContain(baseOptions.manageSubscriptionsUrl);
    expect(html).toContain(baseOptions.unsubscribeUrl);
    expect(html).toContain('Manage subscriptions');
    expect(html).toContain('Unsubscribe');
  });

  it('uses firmName when provided and escapes it', () => {
    const report: DigestReportInput = {
      ...baseReport,
      firmName: 'Firm & Co. <script>',
      ourTake: 'Good.',
    };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('Firm &amp; Co. &lt;script&gt;');
    expect(html).toContain('&amp; Co.');
  });

  it('falls back to firmId when firmName is missing', () => {
    const report: DigestReportInput = { ...baseReport, firmName: undefined };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('firm-a');
  });

  it('includes firm link with baseUrl and firm id', () => {
    const html = buildWeeklyDigestHtml([baseReport], baseOptions);
    expect(html).toContain('View On-Chain Proof');
    expect(html).toContain('propfirms/firm-a');
  });

  it('renders payout change positive and negative', () => {
    const up: DigestReportInput = {
      ...baseReport,
      payouts: { ...baseReport.payouts, changeVsLastWeek: 15 },
    };
    const down: DigestReportInput = {
      ...baseReport,
      firmId: 'firm-b',
      firmName: 'Firm B',
      payouts: { ...baseReport.payouts, changeVsLastWeek: -10 },
    };
    const html = buildWeeklyDigestHtml([up, down], baseOptions);
    expect(html).toContain('↑15%');
    expect(html).toContain('↓10%');
  });

  it('renders rating change positive and negative', () => {
    const up: DigestReportInput = {
      ...baseReport,
      trustpilot: { ...baseReport.trustpilot, ratingChange: 0.5 },
    };
    const down: DigestReportInput = {
      ...baseReport,
      firmId: 'firm-b',
      firmName: 'Firm B',
      trustpilot: { ...baseReport.trustpilot, ratingChange: -0.3 },
    };
    const html = buildWeeklyDigestHtml([up, down], baseOptions);
    expect(html).toContain('↑0.5');
    expect(html).toContain('↓0.3');
  });

  it('handles zero review count for sentiment percentages', () => {
    const report: DigestReportInput = {
      ...baseReport,
      trustpilot: {
        ...baseReport.trustpilot,
        reviewCount: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
      },
    };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('0% positive');
    expect(html).toContain('0% neutral');
    expect(html).toContain('0% negative');
  });

  it('renders company_news with and without source_url', () => {
    const report: DigestReportInput = {
      ...baseReport,
      content: {
        company_news: [
          { title: 'News 1', ai_summary: 'Summary 1', source_url: 'https://x.com/1', content_date: '2025-01-07' },
          { title: 'News 2', ai_summary: 'Summary 2', source_url: null, content_date: '2025-01-08' },
        ],
        rule_change: [],
        promotion: [],
      },
    };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('News 1');
    expect(html).toContain('Summary 1');
    expect(html).toContain('View source');
    expect(html).toContain('https://x.com/1');
    expect(html).toContain('News 2');
    expect(html).toContain('Company News');
  });

  it('renders rule_change and promotion cards', () => {
    const report: DigestReportInput = {
      ...baseReport,
      content: {
        company_news: [],
        rule_change: [
          { title: 'Rule 1', ai_summary: 'Rule summary', source_url: 'https://r.com', content_date: '2025-01-06' },
        ],
        promotion: [
          { title: 'Promo 1', ai_summary: 'Promo summary', source_url: null, content_date: '2025-01-07' },
        ],
      },
    };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('Rule 1');
    expect(html).toContain('Rule Changes');
    expect(html).toContain('Promo 1');
    expect(html).toContain('Promotions');
  });

  it('renders incidents with high, medium, and low severity', () => {
    const report: DigestReportInput = {
      ...baseReport,
      incidents: [
        { incident_type: 't', severity: 'high', title: 'H', summary: 'High incident', review_count: 2 },
        { incident_type: 't', severity: 'medium', title: 'M', summary: 'Medium', review_count: 1 },
        { incident_type: 't', severity: 'low', title: 'L', summary: 'Low', review_count: 0 },
      ],
    };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('Trustpilot Incidents (3)');
    expect(html).toContain('H (high)');
    expect(html).toContain('M (medium)');
    expect(html).toContain('L (low)');
    expect(html).toContain('2 reviews');
  });

  it('escapes HTML in incident title and summary', () => {
    const report: DigestReportInput = {
      ...baseReport,
      incidents: [
        { incident_type: 't', severity: 'low', title: '<b>X</b>', summary: 'Say "hello"', review_count: 0 },
      ],
    };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).toContain('&quot;hello&quot;');
  });

  it('renders industry news section when provided', () => {
    const options: DigestEmailOptions = {
      ...baseOptions,
      industryNews: [
        {
          title: 'Industry Headline',
          ai_summary: 'Summary here.',
          mentioned_firm_ids: ['firm-a', 'firm-b'],
          source_url: 'https://news.com',
          content_date: '2025-01-08',
        },
        {
          title: 'No link',
          ai_summary: 'No source.',
          mentioned_firm_ids: [],
          source_url: null,
          content_date: '2025-01-09',
        },
      ],
    };
    const html = buildWeeklyDigestHtml([baseReport], options);
    expect(html).toContain('Industry News');
    expect(html).toContain('Industry Headline');
    expect(html).toContain('Mentioned: firm-a, firm-b');
    expect(html).toContain('Read more');
    expect(html).toContain('No link');
  });

  it('omits industry news section when empty or undefined', () => {
    const htmlEmpty = buildWeeklyDigestHtml([baseReport], { ...baseOptions, industryNews: [] });
    const htmlUndef = buildWeeklyDigestHtml([baseReport], baseOptions);
    expect(htmlEmpty).not.toContain('Industry News');
    expect(htmlUndef).not.toContain('Industry News');
  });

  it('includes ourTake escaped in analysis section', () => {
    const report: DigestReportInput = {
      ...baseReport,
      ourTake: 'We think <script>alert(1)</script> is bad.',
    };
    const html = buildWeeklyDigestHtml([report], baseOptions);
    expect(html).toContain('PropProof Analysis');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('renders multiple firm sections', () => {
    const reports: DigestReportInput[] = [
      { ...baseReport, firmId: 'f1', firmName: 'First' },
      { ...baseReport, firmId: 'f2', firmName: 'Second' },
    ];
    const html = buildWeeklyDigestHtml(reports, baseOptions);
    expect(html).toContain('First');
    expect(html).toContain('Second');
    expect(html).toContain('/propfirms/f1');
    expect(html).toContain('/propfirms/f2');
  });
});
