/**
 * Tests for lib/gmail/ingest.ts
 */

import { ingestFirmEmails } from './ingest';
import * as client from './client';
import * as parser from './parser';
import * as firmMapper from './firm-mapper';
import * as categorizeModule from '@/lib/ai/categorize-content';
import { createServiceClient } from '@/lib/supabase/service';

jest.mock('./client');
jest.mock('./parser');
jest.mock('./firm-mapper');
jest.mock('@/lib/ai/categorize-content');
jest.mock('@/lib/supabase/service');

const mockListMessageIds = client.listMessageIds as jest.Mock;
const mockGetMessage = client.getMessage as jest.Mock;
const mockParseEmail = parser.parseEmail as jest.Mock;
const mockMapSenderToFirm = firmMapper.mapSenderToFirm as jest.Mock;
const mockCategorizeContent = categorizeModule.categorizeContent as jest.Mock;
const mockCreateServiceClient = createServiceClient as jest.Mock;

function makeSupabaseMock() {
  const single = jest.fn().mockResolvedValue({ data: null, error: null });
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const eqChain = { single, maybeSingle };
  const eq = jest.fn().mockReturnValue(eqChain);
  const selectChain = { eq };
  const select = jest.fn().mockReturnValue(selectChain);
  const insert = jest.fn().mockResolvedValue({ error: null });
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ select, insert, upsert });
  return { from, select, eq, single, maybeSingle, insert, upsert };
}

function makeParsedEmail(overrides = {}) {
  return {
    messageId: 'msg-1',
    subject: 'New payout feature',
    from: 'hello@fundingpips.com',
    senderEmail: 'hello@fundingpips.com',
    senderDomain: 'fundingpips.com',
    date: new Date('2026-03-10'),
    rawContent: 'We launched instant payouts today.',
    ...overrides,
  };
}

function makeCategorizationResult(overrides = {}) {
  return {
    ai_category: 'company_news',
    ai_summary: 'Firm launched instant payouts.',
    ai_confidence: 0.9,
    ai_tags: ['payout', 'instant'],
    mentioned_firm_ids: [],
    ...overrides,
  };
}

describe('ingestFirmEmails', () => {
  let supabase: ReturnType<typeof makeSupabaseMock>;

  beforeEach(() => {
    supabase = makeSupabaseMock();
    mockCreateServiceClient.mockReturnValue(supabase);
    mockListMessageIds.mockResolvedValue([]);
    mockGetMessage.mockResolvedValue({ id: 'msg-1' });
    mockParseEmail.mockReturnValue(makeParsedEmail());
    mockMapSenderToFirm.mockReturnValue({ firmId: 'fundingpips', matchType: 'domain' });
    mockCategorizeContent.mockResolvedValue(makeCategorizationResult());
  });

  it('returns zero counts when no messages', async () => {
    const result = await ingestFirmEmails();

    expect(result).toEqual({ processed: 0, inserted: 0, skipped: 0, errors: 0 });
    expect(supabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_name: 'ingest-firm-emails' })
    );
  });

  it('inserts a new message and auto-publishes when confidence >= 0.75', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1']);

    const result = await ingestFirmEmails();

    expect(result).toEqual({ processed: 1, inserted: 1, skipped: 0, errors: 0 });
    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        firm_id: 'fundingpips',
        content_type: 'company_news',
        published: true,
        external_id: 'msg-1',
      })
    );
  });

  it('does not publish when confidence < 0.75', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1']);
    mockCategorizeContent.mockResolvedValue(makeCategorizationResult({ ai_confidence: 0.6 }));

    await ingestFirmEmails();

    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ published: false, published_at: null })
    );
  });

  it('skips already-ingested messages (dedup)', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1']);
    supabase.maybeSingle.mockResolvedValueOnce({ data: { id: 42 }, error: null });

    const result = await ingestFirmEmails();

    expect(result).toEqual({ processed: 1, inserted: 0, skipped: 1, errors: 0 });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('skips messages from unknown senders', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1']);
    mockMapSenderToFirm.mockReturnValue({ firmId: null, matchType: null });

    const result = await ingestFirmEmails();

    expect(result).toEqual({ processed: 1, inserted: 0, skipped: 1, errors: 0 });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('skips messages with empty body', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1']);
    mockParseEmail.mockReturnValue(makeParsedEmail({ rawContent: '   ' }));

    const result = await ingestFirmEmails();

    expect(result).toEqual({ processed: 1, inserted: 0, skipped: 1, errors: 0 });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('maps industry_news ai_category to other content_type', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1']);
    mockCategorizeContent.mockResolvedValue(
      makeCategorizationResult({ ai_category: 'industry_news' })
    );

    await ingestFirmEmails();

    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ content_type: 'other', ai_category: 'industry_news' })
    );
  });

  it('counts errors and continues processing remaining messages', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1', 'msg-2']);
    mockGetMessage
      .mockRejectedValueOnce(new Error('Gmail API error'))
      .mockResolvedValueOnce({ id: 'msg-2' });

    const result = await ingestFirmEmails();

    expect(result.processed).toBe(2);
    expect(result.errors).toBe(1);
    expect(result.inserted).toBe(1);
  });

  it('counts DB insert error as an error', async () => {
    mockListMessageIds.mockResolvedValue(['msg-1']);
    supabase.insert.mockResolvedValueOnce({ error: { message: 'DB error' } });

    const result = await ingestFirmEmails();

    expect(result).toEqual({ processed: 1, inserted: 0, skipped: 0, errors: 1 });
  });

  it('passes null afterTimestamp when no prior run exists', async () => {
    // default single mock returns { data: null } → no last run
    await ingestFirmEmails();
    expect(mockListMessageIds).toHaveBeenCalledWith(null);
  });

  it('uses last_run_at timestamp for incremental fetch', async () => {
    const lastRunAt = '2026-03-09T10:00:00.000Z';
    supabase.single.mockResolvedValueOnce({ data: { last_run_at: lastRunAt }, error: null });

    await ingestFirmEmails();

    expect(mockListMessageIds).toHaveBeenCalledWith(new Date(lastRunAt).getTime());
  });
});
