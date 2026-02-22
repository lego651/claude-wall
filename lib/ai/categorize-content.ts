/**
 * AI Content Categorization Service (TICKET-S8-003)
 *
 * Categorizes and summarizes firm content and industry news using GPT-4o-mini.
 * Returns: category, summary, confidence, tags, mentioned_firm_ids
 */

import { getOpenAIClient } from './openai-client';

const SYSTEM_PROMPT = `You are a prop trading firm content analyzer. Categorize and summarize content from prop trading firms.

CONTENT TYPES:
- company_news: New features, partnerships, announcements, platform updates
- rule_change: Changes to trading rules, account policies, terms of service, drawdown limits
- promotion: Discounts, competitions, special offers, affiliate bonuses
- industry_news: Industry-wide events, regulations, scandals not specific to one firm
- other: Doesn't fit above categories

FIRM NAMES (for industry news):
fundingpips, fxify, fundednext, the5ers, instantfunding, blueguardian, aquafunded, alphacapitalgroup, ftmo, topstep, apex

INSTRUCTIONS:
1. Read the content carefully
2. Generate a short, catchy title (5-10 words max)
3. Identify the category (pick ONE)
4. Write a concise 1-2 sentence summary
5. Extract 3-5 relevant tags (lowercase, single words)
6. If industry news, identify which firms are mentioned

RETURN JSON:
{
  "title": "Short catchy title for the content",
  "category": "company_news",
  "summary": "One to two sentence summary of the content",
  "confidence": 0.9,
  "tags": ["payout", "instant", "feature"],
  "mentioned_firms": ["fundingpips", "apex"]
}

EXAMPLES:

Input: "We're excited to announce instant payouts! Now you can withdraw within 1 hour."
Output: {
  "category": "company_news",
  "summary": "Firm launched instant payout feature allowing withdrawals within 1 hour.",
  "confidence": 0.95,
  "tags": ["payout", "instant", "withdrawal"],
  "mentioned_firms": []
}

Input: "Effective March 1st, max drawdown reduced from 10% to 8% on all accounts."
Output: {
  "category": "rule_change",
  "summary": "Maximum drawdown limit reduced from 10% to 8% starting March 1st.",
  "confidence": 0.98,
  "tags": ["drawdown", "rules", "limit"],
  "mentioned_firms": []
}

Input: "20% off all challenges this week! Use code SPRING20 at checkout."
Output: {
  "category": "promotion",
  "summary": "Limited-time 20% discount on all challenges with code SPRING20.",
  "confidence": 0.97,
  "tags": ["discount", "promotion", "sale"],
  "mentioned_firms": []
}

Input: "Breaking: Apex Trading suspends all payouts amid SEC investigation. FundingPips users unaffected."
Output: {
  "category": "industry_news",
  "summary": "Apex Trading halted payouts due to SEC investigation; FundingPips not impacted.",
  "confidence": 0.93,
  "tags": ["sec", "investigation", "payout", "suspension"],
  "mentioned_firms": ["apex", "fundingpips"]
}`;

export interface ContentMetadata {
  title?: string;
  source_type?: string;
  firm_id?: string;
}

export interface CategorizationResult {
  ai_category: string;
  ai_summary: string;
  ai_confidence: number;
  ai_tags: string[];
  mentioned_firm_ids: string[];
}

interface AIResponse {
  category: string;
  summary: string;
  confidence: number;
  tags: string[];
  mentioned_firms: string[];
}

/**
 * Categorize and summarize content using AI.
 * @param rawContent - The raw text content to categorize
 * @param metadata - Additional context (title, source_type, firm_id)
 * @returns AI categorization results
 */
export async function categorizeContent(
  rawContent: string,
  metadata: ContentMetadata = {}
): Promise<CategorizationResult> {
  if (!rawContent?.trim()) {
    throw new Error('Raw content is required');
  }

  const { title, source_type, firm_id } = metadata;

  // Build user prompt with metadata context
  const userPromptParts: string[] = [];
  if (title) userPromptParts.push(`Title: ${title}`);
  if (source_type) userPromptParts.push(`Source: ${source_type}`);
  userPromptParts.push(firm_id ? `Firm: ${firm_id}` : 'Industry news (no specific firm)');
  userPromptParts.push('');
  userPromptParts.push('Content:');
  userPromptParts.push(rawContent);

  const userPrompt = userPromptParts.join('\n');

  try {
    const openai = getOpenAIClient();

    console.log('[AI Categorize] Processing content:', {
      contentLength: rawContent.length,
      title: title || 'N/A',
      firm_id: firm_id || 'industry',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const result: AIResponse = JSON.parse(content);

    console.log('[AI Categorize] Result:', {
      category: result.category,
      confidence: result.confidence,
      tags: result.tags,
      mentioned_firms: result.mentioned_firms,
    });

    return {
      ai_category: result.category || 'other',
      ai_summary: result.summary || '',
      ai_confidence: result.confidence || 0.5,
      ai_tags: Array.isArray(result.tags) ? result.tags : [],
      mentioned_firm_ids: Array.isArray(result.mentioned_firms) ? result.mentioned_firms : [],
    };
  } catch (error) {
    console.error('[AI Categorize] Error:', error);

    if (error instanceof Error) {
      // Handle OpenAI-specific errors
      if ('code' in error && error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded');
      }

      if ('status' in error && error.status === 429) {
        throw new Error('OpenAI rate limit exceeded');
      }

      throw new Error(`AI categorization failed: ${error.message}`);
    }

    throw new Error('AI categorization failed: Unknown error');
  }
}
