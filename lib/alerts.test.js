/**
 * Tests for lib/alerts.js — getAdminAlertEmails() and sendAlert()
 */

// Mock dependencies before importing the module under test
jest.mock('@/lib/resend', () => ({
  sendEmail: jest.fn(),
}));
jest.mock('@/config', () => ({
  resend: { fromNoReply: 'Alerts <alerts@example.com>' },
}));

import { sendEmail } from '@/lib/resend';
import { getAdminAlertEmails, sendAlert } from '@/lib/alerts';

// Helper to save and restore env vars around each test
const originalEnv = process.env;

beforeEach(() => {
  jest.resetAllMocks();
  process.env = { ...originalEnv };
  delete process.env.ADMIN_ALERT_EMAILS;
  delete process.env.ALERT_EMAIL;
  delete process.env.ALERTS_TO;
  delete process.env.RESEND_API_KEY;
});

afterAll(() => {
  process.env = originalEnv;
});

// ---------------------------------------------------------------------------
// getAdminAlertEmails()
// ---------------------------------------------------------------------------

describe('getAdminAlertEmails()', () => {
  test('returns parsed list when ADMIN_ALERT_EMAILS is set with multiple addresses', () => {
    process.env.ADMIN_ALERT_EMAILS = 'a@example.com,b@example.com,c@example.com';
    expect(getAdminAlertEmails()).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
  });

  test('trims whitespace from ADMIN_ALERT_EMAILS entries', () => {
    process.env.ADMIN_ALERT_EMAILS = ' a@example.com , b@example.com ';
    expect(getAdminAlertEmails()).toEqual(['a@example.com', 'b@example.com']);
  });

  test('ADMIN_ALERT_EMAILS wins over ALERT_EMAIL when both are set', () => {
    process.env.ADMIN_ALERT_EMAILS = 'admin@example.com';
    process.env.ALERT_EMAIL = 'legacy@example.com';
    expect(getAdminAlertEmails()).toEqual(['admin@example.com']);
  });

  test('falls back to [ALERT_EMAIL] when only ALERT_EMAIL is set', () => {
    process.env.ALERT_EMAIL = 'legacy@example.com';
    expect(getAdminAlertEmails()).toEqual(['legacy@example.com']);
  });

  test('falls back to default address when neither env var is set', () => {
    expect(getAdminAlertEmails()).toEqual(['jasonusca@gmail.com']);
  });

  test('falls back to default when ADMIN_ALERT_EMAILS is empty string', () => {
    process.env.ADMIN_ALERT_EMAILS = '';
    expect(getAdminAlertEmails()).toEqual(['jasonusca@gmail.com']);
  });

  test('falls back to default when ADMIN_ALERT_EMAILS contains only whitespace', () => {
    process.env.ADMIN_ALERT_EMAILS = '   ';
    expect(getAdminAlertEmails()).toEqual(['jasonusca@gmail.com']);
  });

  test('falls back to ALERT_EMAIL when ADMIN_ALERT_EMAILS entries are all whitespace after split', () => {
    process.env.ADMIN_ALERT_EMAILS = ' , , ';
    process.env.ALERT_EMAIL = 'legacy@example.com';
    expect(getAdminAlertEmails()).toEqual(['legacy@example.com']);
  });
});

// ---------------------------------------------------------------------------
// sendAlert()
// ---------------------------------------------------------------------------

describe('sendAlert()', () => {
  test('sends email to all recipients from getAdminAlertEmails()', async () => {
    process.env.ADMIN_ALERT_EMAILS = 'a@example.com,b@example.com';
    process.env.RESEND_API_KEY = 'test-key';
    sendEmail.mockResolvedValue({});

    await sendAlert('TestService', 'Something broke', 'CRITICAL');

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = sendEmail.mock.calls[0][0];
    expect(call.to).toEqual(['a@example.com', 'b@example.com']);
    expect(call.subject).toContain('[CRITICAL]');
    expect(call.subject).toContain('TestService');
  });

  test('uses INFO severity when an unknown severity is passed', async () => {
    process.env.ADMIN_ALERT_EMAILS = 'a@example.com';
    process.env.RESEND_API_KEY = 'test-key';
    sendEmail.mockResolvedValue({});

    await sendAlert('Svc', 'msg', 'UNKNOWN');

    const call = sendEmail.mock.calls[0][0];
    expect(call.subject).toContain('[INFO]');
  });

  test('is a no-op (warns) when RESEND_API_KEY is not set', async () => {
    process.env.ADMIN_ALERT_EMAILS = 'a@example.com';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await sendAlert('Svc', 'msg', 'INFO');

    expect(sendEmail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY'), expect.anything());
    warnSpy.mockRestore();
  });

  test('does not throw when sendEmail rejects', async () => {
    process.env.ADMIN_ALERT_EMAILS = 'a@example.com';
    process.env.RESEND_API_KEY = 'test-key';
    sendEmail.mockRejectedValue(new Error('network error'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(sendAlert('Svc', 'msg', 'WARNING')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send'), 'network error');
    errorSpy.mockRestore();
  });

  test('truncates long messages in the subject', async () => {
    process.env.ADMIN_ALERT_EMAILS = 'a@example.com';
    process.env.RESEND_API_KEY = 'test-key';
    sendEmail.mockResolvedValue({});

    const longMsg = 'A'.repeat(100);
    await sendAlert('Svc', longMsg, 'INFO');

    const subject = sendEmail.mock.calls[0][0].subject;
    expect(subject).toContain('…');
  });

  test('includes details in the text body', async () => {
    process.env.ADMIN_ALERT_EMAILS = 'a@example.com';
    process.env.RESEND_API_KEY = 'test-key';
    sendEmail.mockResolvedValue({});

    await sendAlert('Svc', 'msg', 'INFO', { foo: 'bar' });

    const text = sendEmail.mock.calls[0][0].text;
    expect(text).toContain('"foo": "bar"');
  });

  test('uses default recipient when no env vars set', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    sendEmail.mockResolvedValue({});

    await sendAlert('Svc', 'msg', 'INFO');

    const call = sendEmail.mock.calls[0][0];
    expect(call.to).toEqual(['jasonusca@gmail.com']);
  });
});
