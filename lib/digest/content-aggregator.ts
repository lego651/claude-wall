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
 * Returns top N most recent items.
 */
export async function getIndustryNewsForWeek(
  weekStartDate: string,
  weekEndDate: string,
  limit: number = 10
): Promise<IndustryNewsItem[]> {
  const supabase = createServiceClient();

  const { data: items, error } = await supabase
    .from('industry_news_items')
    .select('*')
    .eq('published', true)
    .gte('content_date', weekStartDate)
    .lte('content_date', weekEndDate)
    .order('content_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Content Aggregator] Error fetching industry news:', error);
    return [];
  }

  return (items || []) as unknown as IndustryNewsItem[];
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
