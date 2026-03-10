/**
 * Gmail Message Parser
 * Extracts clean text content from raw Gmail messages.
 */

import type { GmailMessage } from './client';

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: string;
  senderEmail: string;
  senderDomain: string;
  date: Date;
  rawContent: string; // plain text, HTML stripped
}

/**
 * Parse a raw GmailMessage into a clean ParsedEmail.
 */
export function parseEmail(msg: GmailMessage): ParsedEmail {
  const senderEmail = extractEmail(msg.from);
  const senderDomain = senderEmail.split('@')[1]?.toLowerCase() ?? '';

  // Prefer plain text; fall back to stripping HTML
  const rawContent = msg.bodyText?.trim()
    ? cleanText(msg.bodyText)
    : stripHtml(msg.bodyHtml);

  return {
    messageId: msg.id,
    subject: msg.subject,
    from: msg.from,
    senderEmail,
    senderDomain,
    date: parseDate(msg.date),
    rawContent,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract bare email address from "Display Name <email@domain.com>" */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return from.trim().toLowerCase();
}

/** Parse RFC 2822 date string to Date, falling back to now */
function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Strip HTML tags and decode common entities */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Normalize whitespace in plain text */
function cleanText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
