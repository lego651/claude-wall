/**
 * Gmail API Client
 * Wraps googleapis Gmail API with OAuth2 refresh token auth.
 */

import { google } from 'googleapis';

function getGmailClient() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL } =
    process.env;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER_EMAIL) {
    throw new Error(
      'Missing Gmail env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL'
    );
  }

  const auth = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

  return google.gmail({ version: 'v1', auth });
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
}

/**
 * List message IDs received after a given timestamp (Unix ms).
 * If afterTimestamp is null, returns all inbox messages (first 100).
 */
export async function listMessageIds(afterTimestamp: number | null): Promise<string[]> {
  const gmail = getGmailClient();
  const userEmail = process.env.GMAIL_USER_EMAIL!;

  const q = afterTimestamp
    ? `in:inbox after:${Math.floor(afterTimestamp / 1000)}`
    : 'in:inbox';

  const res = await gmail.users.messages.list({
    userId: userEmail,
    q,
    maxResults: 100,
  });

  return res.data.messages?.map((m) => m.id!) ?? [];
}

/**
 * Fetch a full Gmail message by ID.
 */
export async function getMessage(messageId: string): Promise<GmailMessage> {
  const gmail = getGmailClient();
  const userEmail = process.env.GMAIL_USER_EMAIL!;

  const res = await gmail.users.messages.get({
    userId: userEmail,
    id: messageId,
    format: 'full',
  });

  const msg = res.data;
  const headers = msg.payload?.headers ?? [];

  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '';
  const from = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
  const date = headers.find((h) => h.name?.toLowerCase() === 'date')?.value ?? '';

  const { bodyText, bodyHtml } = extractBody(msg.payload);

  return {
    id: msg.id!,
    threadId: msg.threadId!,
    subject,
    from,
    date,
    bodyText,
    bodyHtml,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface MessagePart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: MessagePart[] | null;
}

function extractBody(payload: MessagePart | null | undefined): {
  bodyText: string;
  bodyHtml: string;
} {
  if (!payload) return { bodyText: '', bodyHtml: '' };

  let bodyText = '';
  let bodyHtml = '';

  function walk(part: MessagePart) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) {
      for (const child of part.parts) walk(child);
    }
  }

  walk(payload);
  return { bodyText, bodyHtml };
}
