/**
 * Content Aggregator for Weekly Digest (TICKET-S8-009)
 *
 * Fetches firm content and industry news for inclusion in weekly digest emails.
 * Complements existing Trustpilot incident aggregation.
 */

import { createServiceClient } from '@/lib/supabase/service';

export interface FirmContentItem {
  id: number;
  firm_id: string;
  content_type: 'company_news' | 'rule_change' | 'promotion' | 'other';
  title: string;
  ai_summary: string;
  ai_category: string;
  ai_confidence: number;
  ai_tags: string[];
  source_url: string | null;
  screenshot_url: string | null;
  content_date: string;
  published_at: string;
}

export interface IndustryNewsItem {
  id: number;
  title: string;
  ai_summary: string;
  ai_category: string;
  ai_confidence: number;
  ai_tags: string[];
  mentioned_firm_ids: string[];
  source_url: string | null;
  screenshot_url: string | null;
  content_date: string;
  published_at: string;
}

export interface FirmContentByType {
  company_news: FirmContentItem[];
  rule_change: FirmContentItem[];
  promotion: FirmContentItem[];
}

/** Top tweet for digest (S8-TW-006b): up to 3 per firm per week by importance_score */
export interface FirmTopTweet {
  url: string;
  text: string;
  author_username: string | null;
  tweeted_at: string;
  ai_summary: string | null;
  importance_score: number;
}

/**
 * Fetch firm content for a specific firm within a date range (published only).
 * Groups content by type for easy template rendering.
 */
export async function getFirmContentForWeek(
  firmId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<FirmContentByType> {
  const supabase = createServiceClient();

  const { data: items, error } = await supabase
    .from('firm_content_items')
    .select('*')
    .eq('firm_id', firmId)
    .eq('published', true)
    .gte('content_date', weekStartDate)
    .lte('content_date', weekEndDate)
    .order('content_date', { ascending: false });

  if (error) {
    console.error('[Content Aggregator] Error fetching firm content:', error);
    return {
      company_news: [],
      rule_change: [],
      promotion: [],
    };
  }

  const content = (items || []) as unknown as FirmContentItem[];

  return {
    company_news: content.filter((item) => item.content_type === 'company_news'),
    rule_change: content.filter((item) => item.content_type === 'rule_change'),
    promotion: content.filter((item) => item.content_type === 'promotion'),
  };
}

/**
 * Fetch industry news for the week (published only).
 * Includes industry_news_items (manual, etc.) and industry tweets from firm_twitter_tweets (firm_id='industry').
 * Returns top N most recent items merged and sorted by date.
 */
export async function getIndustryNewsForWeek(
  weekStartDate: string,
  weekEndDate: string,
  limit: number = 10
): Promise<IndustryNewsItem[]> {
  const supabase = createServiceClient();

  const [
    { data: newsItems, error: newsError },
    { data: tweetRows, error: tweetError },
  ] = await Promise.all([
    supabase
      .from('industry_news_items')
      .select('*')
      .eq('published', true)
      .gte('content_date', weekStartDate)
      .lte('content_date', weekEndDate)
      .order('content_date', { ascending: false }),
    supabase
      .from('firm_twitter_tweets')
      .select('id, text, url, ai_summary, tweeted_at')
      .eq('firm_id', 'industry')
      .eq('published', true)
      .gte('tweeted_at', weekStartDate)
      .lte('tweeted_at', weekEndDate)
      .order('tweeted_at', { ascending: false }),
  ]);

  if (newsError) {
    console.error('[Content Aggregator] Error fetching industry_news_items:', newsError);
  }
  if (tweetError) {
    console.error('[Content Aggregator] Error fetching industry tweets:', tweetError);
  }

  const fromNews = (newsItems || []) as unknown as IndustryNewsItem[];
  const fromTweets = ((tweetRows || []) as { id: number; text: string; url: string; ai_summary: string | null; tweeted_at: string }[]).map(
    (r) =>
      ({
        id: r.id,
        title: (r.text || '').slice(0, 200).trim() || 'Tweet',
        ai_summary: r.ai_summary || '',
        ai_category: 'other',
        ai_confidence: 0.8,
        ai_tags: [],
        mentioned_firm_ids: [],
        source_url: r.url,
        screenshot_url: null,
        content_date: r.tweeted_at,
        published_at: r.tweeted_at,
      }) as IndustryNewsItem
  );

  const merged = [...fromNews, ...fromTweets].sort(
    (a, b) => (b.content_date || '').localeCompare(a.content_date || '')
  );
  return merged.slice(0, limit);
}

/**
 * Fetch all firm content for multiple firms (for user digest with multiple subscriptions).
 * Returns a map of firmId -> content grouped by type.
 */
export async function getBulkFirmContent(
  firmIds: string[],
  weekStartDate: string,
  weekEndDate: string
): Promise<Map<string, FirmContentByType>> {
  if (firmIds.length === 0) {
    return new Map();
  }

  const supabase = createServiceClient();

  const { data: items, error } = await supabase
    .from('firm_content_items')
    .select('*')
    .in('firm_id', firmIds)
    .eq('published', true)
    .gte('content_date', weekStartDate)
    .lte('content_date', weekEndDate)
    .order('content_date', { ascending: false });

  if (error) {
    console.error('[Content Aggregator] Error fetching bulk firm content:', error);
    return new Map();
  }

  const content = (items || []) as unknown as FirmContentItem[];
  const contentByFirm = new Map<string, FirmContentByType>();

  // Initialize all firms with empty arrays
  for (const firmId of firmIds) {
    contentByFirm.set(firmId, {
      company_news: [],
      rule_change: [],
      promotion: [],
    });
  }

  // Group items by firm and type
  for (const item of content) {
    const firmContent = contentByFirm.get(item.firm_id);
    if (!firmContent) continue;

    if (item.content_type === 'company_news') {
      firmContent.company_news.push(item);
    } else if (item.content_type === 'rule_change') {
      firmContent.rule_change.push(item);
    } else if (item.content_type === 'promotion') {
      firmContent.promotion.push(item);
    }
  }

  return contentByFirm;
}

const TOP_TWEETS_PER_FIRM = 3;

/**
 * Fetch top tweets per firm for the report week (S8-TW-006b).
 * For each firm: up to 3 tweets with tweeted_at in [weekStartDate, weekEndDate],
 * ordered by importance_score DESC.
 */
export async function getTopTweetsForFirms(
  firmIds: string[],
  weekStartDate: string,
  weekEndDate: string
): Promise<Map<string, FirmTopTweet[]>> {
  if (firmIds.length === 0) {
    return new Map();
  }

  const supabase = createServiceClient();

  const { data: rows, error } = await supabase
    .from('firm_twitter_tweets')
    .select('firm_id, url, text, author_username, tweeted_at, ai_summary, importance_score')
    .in('firm_id', firmIds)
    .gte('tweeted_at', weekStartDate)
    .lte('tweeted_at', weekEndDate);

  if (error) {
    console.error('[Content Aggregator] Error fetching top tweets:', error);
    return new Map();
  }

  const items = (rows || []) as Array<{
    firm_id: string;
    url: string;
    text: string;
    author_username: string | null;
    tweeted_at: string;
    ai_summary: string | null;
    importance_score: number;
  }>;

  // Group by firm, then take top 3 by importance_score per firm
  const grouped = new Map<string, typeof items>();
  for (const row of items) {
    const list = grouped.get(row.firm_id) ?? [];
    list.push(row);
    grouped.set(row.firm_id, list);
  }

  const byFirm = new Map<string, FirmTopTweet[]>();
  for (const firmId of firmIds) {
    const list = grouped.get(firmId) ?? [];
    const top = list
      .sort((a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0))
      .slice(0, TOP_TWEETS_PER_FIRM)
      .map((row) => ({
        url: row.url,
        text: row.text,
        author_username: row.author_username ?? null,
        tweeted_at: row.tweeted_at,
        ai_summary: row.ai_summary ?? null,
        importance_score: row.importance_score ?? 0,
      }));
    byFirm.set(firmId, top);
  }

  return byFirm;
}
