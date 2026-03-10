/**
 * Gmail Ingest Orchestrator
 * Fetches new emails from Gmail, categorizes with AI, and writes to firm_content_items.
 *
 * Called by: app/api/cron/ingest-firm-emails/route.js
 */

import { listMessageIds, getMessage } from './client';
import { parseEmail } from './parser';
import { mapSenderToFirmDB } from './firm-mapper';
import { categorizeContent } from '@/lib/ai/categorize-content';
import { createServiceClient } from '@/lib/supabase/service';

const JOB_NAME = 'ingest-firm-emails';
const AUTO_PUBLISH_THRESHOLD = 0.75;

// content_type column only accepts these values (industry_news maps to 'other')
const VALID_CONTENT_TYPES = new Set(['company_news', 'rule_change', 'promotion', 'other']);

export interface IngestResult {
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
}

export async function ingestFirmEmails(): Promise<IngestResult> {
  const supabase = createServiceClient();

  // Get last run timestamp for incremental fetch
  const { data: lastRun } = await supabase
    .from('cron_last_run')
    .select('last_run_at')
    .eq('job_name', JOB_NAME)
    .single();

  const afterTimestamp = lastRun?.last_run_at ? new Date(lastRun.last_run_at).getTime() : null;
  const runStartedAt = new Date().toISOString();

  console.log(
    `[GmailIngest] Starting. After: ${afterTimestamp ? new Date(afterTimestamp).toISOString() : 'all time'}`
  );

  const messageIds = await listMessageIds(afterTimestamp);
  console.log(`[GmailIngest] Found ${messageIds.length} messages to process`);

  const result: IngestResult = { processed: 0, inserted: 0, skipped: 0, errors: 0 };

  for (const messageId of messageIds) {
    result.processed++;

    try {
      // Dedup check — skip if already ingested
      const { data: existing } = await supabase
        .from('firm_content_items')
        .select('id')
        .eq('external_id', messageId)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }

      const msg = await getMessage(messageId);
      const parsed = parseEmail(msg);
      const { firmId } = await mapSenderToFirmDB(parsed.senderEmail, supabase);

      if (!firmId) {
        console.log(`[GmailIngest] Unknown sender: ${parsed.senderEmail} — skipping`);
        result.skipped++;
        continue;
      }

      if (!parsed.rawContent.trim()) {
        console.log(`[GmailIngest] Empty body for message ${messageId} — skipping`);
        result.skipped++;
        continue;
      }

      const categorized = await categorizeContent(parsed.rawContent, {
        title: parsed.subject,
        source_type: 'firm_email',
        firm_id: firmId,
      });

      const contentType = VALID_CONTENT_TYPES.has(categorized.ai_category)
        ? categorized.ai_category
        : 'other';

      const published = categorized.ai_confidence >= AUTO_PUBLISH_THRESHOLD;

      const { error } = await supabase.from('firm_content_items').insert({
        firm_id: firmId,
        content_type: contentType,
        title: parsed.subject || 'Untitled Email',
        raw_content: parsed.rawContent,
        source_type: 'firm_email',
        ai_summary: categorized.ai_summary,
        ai_category: categorized.ai_category,
        ai_confidence: categorized.ai_confidence,
        ai_tags: categorized.ai_tags,
        content_date: parsed.date.toISOString().split('T')[0],
        published,
        published_at: published ? new Date().toISOString() : null,
        external_id: messageId,
      });

      if (error) throw error;

      result.inserted++;
      console.log(
        `[GmailIngest] Inserted: "${parsed.subject}" (firm=${firmId}, type=${contentType}, confidence=${categorized.ai_confidence})`
      );
    } catch (err) {
      result.errors++;
      console.error(`[GmailIngest] Error processing message ${messageId}:`, err);
    }
  }

  // Persist run timestamp and summary for admin dashboard
  await supabase.from('cron_last_run').upsert({
    job_name: JOB_NAME,
    last_run_at: runStartedAt,
    result_json: result,
  });

  console.log(`[GmailIngest] Done:`, result);
  return result;
}
