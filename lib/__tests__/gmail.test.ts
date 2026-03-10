/**
 * Unit tests for lib/gmail — client, parser, firm-mapper
 */

// ---------------------------------------------------------------------------
// googleapis mock — minimal stubs; implementations re-applied in beforeEach
// because resetMocks:true (jest.config) wipes mockImplementation between tests
// ---------------------------------------------------------------------------

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn() },
    gmail: jest.fn(),
  },
}));

import { google } from 'googleapis';
import { listMessageIds, getMessage } from '../gmail/client';
import { parseEmail } from '../gmail/parser';
import { mapSenderToFirm } from '../gmail/firm-mapper';
import type { GmailMessage } from '../gmail/client';

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------

const mockMessagesList = jest.fn();
const mockMessagesGet = jest.fn();

const ENV = {
  GMAIL_CLIENT_ID: 'test-client-id',
  GMAIL_CLIENT_SECRET: 'test-secret',
  GMAIL_REFRESH_TOKEN: 'test-refresh-token',
  GMAIL_USER_EMAIL: 'monitor@example.com',
};

// ---------------------------------------------------------------------------
// lib/gmail/client
// ---------------------------------------------------------------------------

describe('lib/gmail/client', () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
    // Re-apply after resetMocks clears implementations
    (google.auth.OAuth2 as jest.Mock).mockImplementation(() => ({ setCredentials: jest.fn() }));
    (google.gmail as jest.Mock).mockReturnValue({
      users: { messages: { list: mockMessagesList, get: mockMessagesGet } },
    });
  });

  describe('listMessageIds', () => {
    it('returns message IDs from the API', async () => {
      mockMessagesList.mockResolvedValue({
        data: { messages: [{ id: 'msg1' }, { id: 'msg2' }] },
      });
      const ids = await listMessageIds(null);
      expect(ids).toEqual(['msg1', 'msg2']);
    });

    it('returns empty array when no messages', async () => {
      mockMessagesList.mockResolvedValue({ data: {} });
      const ids = await listMessageIds(null);
      expect(ids).toEqual([]);
    });

    it('includes after: filter when timestamp provided', async () => {
      mockMessagesList.mockResolvedValue({ data: { messages: [] } });
      await listMessageIds(1700000000000);
      expect(mockMessagesList).toHaveBeenCalledWith(
        expect.objectContaining({ q: expect.stringContaining('after:') })
      );
    });

    it('throws when env vars are missing', async () => {
      delete process.env.GMAIL_CLIENT_ID;
      await expect(listMessageIds(null)).rejects.toThrow('Missing Gmail env vars');
    });
  });

  describe('getMessage', () => {
    const rawMsg = {
      data: {
        id: 'msg1',
        threadId: 'thread1',
        payload: {
          headers: [
            { name: 'Subject', value: 'Hello World' },
            { name: 'From', value: 'Sender <sender@fundingpips.com>' },
            { name: 'Date', value: 'Mon, 10 Mar 2026 09:00:00 +0000' },
          ],
          mimeType: 'multipart/alternative',
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('Plain text body').toString('base64') },
            },
            {
              mimeType: 'text/html',
              body: { data: Buffer.from('<p>HTML body</p>').toString('base64') },
            },
          ],
        },
      },
    };

    it('returns a parsed GmailMessage', async () => {
      mockMessagesGet.mockResolvedValue(rawMsg);
      const msg = await getMessage('msg1');
      expect(msg.id).toBe('msg1');
      expect(msg.subject).toBe('Hello World');
      expect(msg.from).toBe('Sender <sender@fundingpips.com>');
      expect(msg.bodyText).toBe('Plain text body');
      expect(msg.bodyHtml).toBe('<p>HTML body</p>');
    });

    it('handles missing payload gracefully', async () => {
      mockMessagesGet.mockResolvedValue({ data: { id: 'x', threadId: 't', payload: null } });
      const msg = await getMessage('x');
      expect(msg.subject).toBe('');
      expect(msg.bodyText).toBe('');
    });

    it('handles nested multipart parts', async () => {
      mockMessagesGet.mockResolvedValue({
        data: {
          id: 'nested',
          threadId: 't1',
          payload: {
            headers: [],
            mimeType: 'multipart/mixed',
            parts: [
              {
                mimeType: 'multipart/alternative',
                parts: [
                  {
                    mimeType: 'text/plain',
                    body: { data: Buffer.from('Nested plain').toString('base64') },
                  },
                ],
              },
            ],
          },
        },
      });
      const msg = await getMessage('nested');
      expect(msg.bodyText).toBe('Nested plain');
    });
  });
});

// ---------------------------------------------------------------------------
// lib/gmail/parser
// ---------------------------------------------------------------------------

describe('lib/gmail/parser', () => {
  const makeMsg = (overrides: Partial<GmailMessage> = {}): GmailMessage => ({
    id: 'msg1',
    threadId: 't1',
    subject: 'Test Subject',
    from: 'FundingPips <news@fundingpips.com>',
    date: 'Mon, 10 Mar 2026 09:00:00 +0000',
    bodyText: 'Hello trader!',
    bodyHtml: '',
    ...overrides,
  });

  it('extracts senderEmail from angle-bracket format', () => {
    const result = parseEmail(makeMsg());
    expect(result.senderEmail).toBe('news@fundingpips.com');
  });

  it('extracts senderDomain', () => {
    const result = parseEmail(makeMsg());
    expect(result.senderDomain).toBe('fundingpips.com');
  });

  it('uses bodyText when available', () => {
    const result = parseEmail(makeMsg({ bodyText: 'plain text' }));
    expect(result.rawContent).toBe('plain text');
  });

  it('falls back to stripped HTML when bodyText is empty', () => {
    const result = parseEmail(
      makeMsg({ bodyText: '', bodyHtml: '<p>Hello <b>world</b></p>' })
    );
    expect(result.rawContent).toContain('Hello');
    expect(result.rawContent).not.toContain('<p>');
  });

  it('strips style and script tags from HTML', () => {
    const result = parseEmail(
      makeMsg({
        bodyText: '',
        bodyHtml: '<style>.foo{color:red}</style><script>alert(1)</script><p>Content</p>',
      })
    );
    expect(result.rawContent).not.toContain('<style>');
    expect(result.rawContent).not.toContain('<script>');
    expect(result.rawContent).toContain('Content');
  });

  it('decodes HTML entities', () => {
    const result = parseEmail(
      makeMsg({ bodyText: '', bodyHtml: '<p>Price &amp; value &lt;100&gt;</p>' })
    );
    expect(result.rawContent).toContain('&');
    expect(result.rawContent).toContain('<100>');
  });

  it('parses date correctly', () => {
    const result = parseEmail(makeMsg());
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.getFullYear()).toBe(2026);
  });

  it('falls back to now for invalid date', () => {
    const before = Date.now();
    const result = parseEmail(makeMsg({ date: 'not-a-date' }));
    expect(result.date.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('handles bare email (no display name)', () => {
    const result = parseEmail(makeMsg({ from: 'news@fxify.com' }));
    expect(result.senderEmail).toBe('news@fxify.com');
    expect(result.senderDomain).toBe('fxify.com');
  });
});

// ---------------------------------------------------------------------------
// lib/gmail/firm-mapper
// ---------------------------------------------------------------------------

describe('lib/gmail/firm-mapper', () => {
  it('maps known domain to firm_id', () => {
    const result = mapSenderToFirm('news@fundingpips.com');
    expect(result.firmId).toBe('fundingpips');
    expect(result.matchType).toBe('domain');
  });

  it('maps full email override', () => {
    const result = mapSenderToFirm('updates@fundingpips.com');
    expect(result.firmId).toBe('fundingpips');
    expect(result.matchType).toBe('email');
  });

  it('returns null for unknown sender', () => {
    const result = mapSenderToFirm('unknown@randomfirm.com');
    expect(result.firmId).toBeNull();
    expect(result.matchType).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = mapSenderToFirm('NEWS@FTMO.COM');
    expect(result.firmId).toBe('ftmo');
  });

  it('maps all expected domains', () => {
    const domains: [string, string][] = [
      ['a@fxify.com', 'fxify'],
      ['a@fundednext.com', 'fundednext'],
      ['a@the5ers.com', 'the5ers'],
      ['a@ftmo.com', 'ftmo'],
      ['a@topstep.com', 'topstep'],
      ['a@apextraderfunding.com', 'apex'],
    ];
    for (const [email, expected] of domains) {
      expect(mapSenderToFirm(email).firmId).toBe(expected);
    }
  });
});
