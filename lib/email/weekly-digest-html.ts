/**
 * TICKET-011: HTML Email Template for weekly digest
 * One aggregated email per user: header + one section per firm + footer.
 * Inline CSS for email clients; mobile-responsive (max-width: 600px).
 */

export interface FirmContentItem {
  title: string;
  ai_summary: string;
  source_url: string | null;
  content_date: string;
}

export interface DigestReportInput {
  firmId: string;
  firmName?: string;
  weekStart: string;
  weekEnd: string;
  payouts: {
    total: number;
    count: number;
    largest: number;
    avgPayout: number;
    changeVsLastWeek: number | null;
  };
  trustpilot: {
    avgRating: number;
    ratingChange: number | null;
    reviewCount: number;
    sentiment: { positive: number; neutral: number; negative: number };
  };
  incidents: Array<{
    incident_type: string;
    severity: string;
    title: string;
    summary: string;
    review_count: number;
  }>;
  ourTake: string;
  // NEW: Firm content (TICKET-S8-010)
  content?: {
    company_news: FirmContentItem[];
    rule_change: FirmContentItem[];
    promotion: FirmContentItem[];
  };
  // S8-TW-006b: Top tweets per firm (up to 3 per week)
  topTweets?: Array<{
    url: string;
    text: string;
    author_username: string | null;
    tweeted_at: string;
    ai_summary: string | null;
    importance_score: number;
  }>;
}

export interface IndustryNewsItem {
  title: string;
  ai_summary: string;
  mentioned_firm_ids: string[];
  source_url: string | null;
  content_date: string;
}

export interface DigestEmailOptions {
  weekStart: string;
  weekEnd: string;
  manageSubscriptionsUrl: string;
  unsubscribeUrl: string;
  baseUrl: string;
  // NEW: Industry news (TICKET-S8-010)
  industryNews?: IndustryNewsItem[];
}

function severityColor(severity: string): string {
  if (severity === 'high') return '#dc2626';
  if (severity === 'medium') return '#ca8a04';
  return '#16a34a';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildWeeklyDigestHtml(
  reports: DigestReportInput[],
  options: DigestEmailOptions
): string {
  const { weekStart, weekEnd, manageSubscriptionsUrl, unsubscribeUrl, baseUrl } = options;
  const weekLabel = `Week of ${weekStart} – ${weekEnd}`;

  const firmSections = reports
    .map((r) => {
      const firmName = r.firmName ?? r.firmId;
      const firmUrl = `${baseUrl}/propfirms/${r.firmId}`.replace(/\/\/+/g, '/');
      const changePayout =
        r.payouts.changeVsLastWeek != null
          ? r.payouts.changeVsLastWeek >= 0
            ? `<span style="color:#059669;">↑${r.payouts.changeVsLastWeek}%</span>`
            : `<span style="color:#dc2626;">↓${Math.abs(r.payouts.changeVsLastWeek)}%</span>`
          : '';
      const changeRating =
        r.trustpilot.ratingChange != null
          ? r.trustpilot.ratingChange >= 0
            ? `<span style="color:#059669;">↑${r.trustpilot.ratingChange.toFixed(1)}</span>`
            : `<span style="color:#dc2626;">↓${Math.abs(r.trustpilot.ratingChange).toFixed(1)}</span>`
          : '';
      const pctPos =
        r.trustpilot.reviewCount > 0
          ? Math.round((r.trustpilot.sentiment.positive / r.trustpilot.reviewCount) * 100)
          : 0;
      const pctNeu =
        r.trustpilot.reviewCount > 0
          ? Math.round((r.trustpilot.sentiment.neutral / r.trustpilot.reviewCount) * 100)
          : 0;
      const pctNeg =
        r.trustpilot.reviewCount > 0
          ? Math.round((r.trustpilot.sentiment.negative / r.trustpilot.reviewCount) * 100)
          : 0;

      // Firm content cards (TICKET-S8-010)
      const companyNewsCards = (r.content?.company_news || [])
        .map(
          (item) => `
    <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:16px;margin:12px 0;">
      <h3 style="margin:0 0 8px 0;color:#047857;font-size:16px;">📢 ${escapeHtml(item.title)}</h3>
      <p style="color:#065f46;margin:0;font-size:14px;">${escapeHtml(item.ai_summary)}</p>
      ${item.source_url ? `<p style="margin:8px 0 0 0;"><a href="${item.source_url}" style="color:#059669;font-size:12px;text-decoration:none;">View source →</a></p>` : ''}
    </div>`
        )
        .join('');

      const ruleChangeCards = (r.content?.rule_change || [])
        .map(
          (item) => `
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;margin:12px 0;">
      <h3 style="margin:0 0 8px 0;color:#b91c1c;font-size:16px;">⚠️ ${escapeHtml(item.title)}</h3>
      <p style="color:#7f1d1d;margin:0;font-size:14px;">${escapeHtml(item.ai_summary)}</p>
      ${item.source_url ? `<p style="margin:8px 0 0 0;"><a href="${item.source_url}" style="color:#dc2626;font-size:12px;text-decoration:none;">View source →</a></p>` : ''}
    </div>`
        )
        .join('');

      const promotionCards = (r.content?.promotion || [])
        .map(
          (item) => `
    <div style="background:#faf5ff;border-left:4px solid #a855f7;padding:16px;margin:12px 0;">
      <h3 style="margin:0 0 8px 0;color:#7e22ce;font-size:16px;">🎁 ${escapeHtml(item.title)}</h3>
      <p style="color:#6b21a8;margin:0;font-size:14px;">${escapeHtml(item.ai_summary)}</p>
      ${item.source_url ? `<p style="margin:8px 0 0 0;"><a href="${item.source_url}" style="color:#7c3aed;font-size:12px;text-decoration:none;">View offer →</a></p>` : ''}
    </div>`
        )
        .join('');

      // Top tweets (S8-TW-006b): up to 3 per firm per week
      const topTweetsCards = (r.topTweets || [])
        .map(
          (t) => `
    <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;padding:16px;margin:12px 0;">
      <p style="color:#0c4a6e;margin:0;font-size:14px;line-height:1.5;">${escapeHtml(t.ai_summary || t.text.slice(0, 200))}</p>
      ${t.author_username ? `<p style="margin:8px 0 0 0;font-size:12px;color:#0369a1;">@${escapeHtml(t.author_username)} · ${t.tweeted_at}</p>` : `<p style="margin:8px 0 0 0;font-size:12px;color:#0369a1;">${t.tweeted_at}</p>`}
      ${t.url ? `<p style="margin:8px 0 0 0;"><a href="${t.url}" style="color:#0284c7;font-size:12px;text-decoration:none;">View tweet →</a></p>` : ''}
    </div>`
        )
        .join('');

      const incidentCards = r.incidents
        .map(
          (i) => `
    <div style="background:#fef2f2;border-left:4px solid ${severityColor(i.severity)};padding:16px;margin:12px 0;">
      <h3 style="margin:0 0 8px 0;color:#991b1b;font-size:16px;">⚠️ ${escapeHtml(i.title)} (${i.severity})</h3>
      <p style="color:#450a0a;margin:0;font-size:14px;">${escapeHtml(i.summary)}</p>
      <p style="color:#7f1d1d;font-size:12px;margin:8px 0 0 0;">${i.review_count} reviews</p>
    </div>`
        )
        .join('');

      return `
  <div style="padding:24px;border-bottom:1px solid #e5e7eb;">
    <h2 style="margin:0 0 16px 0;font-size:20px;color:#111827;">${escapeHtml(firmName)}</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="padding:8px 0;"><strong>📊 Payouts</strong></td></tr>
      <tr><td style="padding:4px 0;color:#374151;">$${r.payouts.total.toLocaleString()} ${changePayout} · ${r.payouts.count} payouts (largest: $${r.payouts.largest.toLocaleString()}, avg: $${r.payouts.avgPayout.toLocaleString()})</td></tr>
      <tr><td style="padding:12px 0 0 0;"><strong>💬 Trustpilot</strong></td></tr>
      <tr><td style="padding:4px 0;color:#374151;">${r.trustpilot.avgRating.toFixed(1)}/5 ${changeRating} · ${r.trustpilot.reviewCount} reviews · 😊 ${pctPos}% positive · 😐 ${pctNeu}% neutral · 😟 ${pctNeg}% negative</td></tr>
    </table>
    ${companyNewsCards ? `<p style="margin:0 0 8px 0;"><strong>📢 Company News</strong></p>${companyNewsCards}` : ''}
    ${ruleChangeCards ? `<p style="margin:16px 0 8px 0;"><strong>⚠️ Rule Changes</strong></p>${ruleChangeCards}` : ''}
    ${promotionCards ? `<p style="margin:16px 0 8px 0;"><strong>🎁 Promotions</strong></p>${promotionCards}` : ''}
    ${topTweetsCards ? `<p style="margin:16px 0 8px 0;"><strong>🐦 Top Tweets</strong></p>${topTweetsCards}` : ''}
    ${r.incidents.length > 0 ? `<p style="margin:16px 0 8px 0;"><strong>🚨 Trustpilot Incidents (${r.incidents.length})</strong></p>${incidentCards}` : ''}
    <p style="margin:16px 0 0 0;"><strong>⚖️ PropProof Analysis</strong></p>
    <p style="color:#374151;margin:8px 0 0 0;font-size:14px;line-height:1.5;">${escapeHtml(r.ourTake)}</p>
    <p style="margin:16px 0 0 0;"><a href="${firmUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">View On-Chain Proof</a></p>
  </div>`;
    })
    .join('');

  // Industry news section (TICKET-S8-010)
  const industryNewsSection = (options.industryNews && options.industryNews.length > 0)
    ? `
    <div style="padding:24px;background:#eff6ff;border-bottom:1px solid #bfdbfe;">
      <h2 style="margin:0 0 16px 0;font-size:20px;color:#1e40af;">📰 Industry News</h2>
      ${options.industryNews.map((item) => `
        <div style="background:#fff;border-left:4px solid #3b82f6;padding:16px;margin:12px 0;border-radius:4px;">
          <h3 style="margin:0 0 8px 0;color:#1e3a8a;font-size:16px;">${escapeHtml(item.title)}</h3>
          <p style="color:#1e40af;margin:0;font-size:14px;line-height:1.5;">${escapeHtml(item.ai_summary)}</p>
          ${item.mentioned_firm_ids.length > 0 ? `<p style="margin:8px 0 0 0;font-size:12px;color:#60a5fa;">Mentioned: ${item.mentioned_firm_ids.join(', ')}</p>` : ''}
          ${item.source_url ? `<p style="margin:8px 0 0 0;"><a href="${item.source_url}" style="color:#2563eb;font-size:12px;text-decoration:none;">Read more →</a></p>` : ''}
        </div>
      `).join('')}
    </div>
    ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Weekly Digest - ${weekLabel}</title>
</head>
<body style="font-family:Arial,sans-serif;margin:0;background:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    <div style="background:linear-gradient(to right, #7c3aed, #2563eb);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">Your Weekly Digest</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0 0;font-size:14px;">${weekLabel}</p>
    </div>
    ${industryNewsSection}
    ${firmSections}
    <div style="padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        <a href="${manageSubscriptionsUrl}" style="color:#6b7280;">Manage subscriptions</a>
        &nbsp;|&nbsp;
        <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a>
      </p>
    </div>
    <div style="background:#f9fafb;padding:24px;text-align:center;">
      <p style="color:#6b7280;font-size:12px;margin:0;">PropProof – Blockchain-verified prop firm intelligence</p>
    </div>
  </div>
</body>
</html>`;
}
