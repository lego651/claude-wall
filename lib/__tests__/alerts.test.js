/**
 * PROP-022: Unit tests for lib/alerts
 */

const mockSendEmail = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/resend', () => ({
  sendEmail: (...args) => mockSendEmail(...args),
}));

jest.mock('@/config', () => ({
  __esModule: true,
  default: { resend: { fromNoReply: 'Test <noreply@test>' } },
}));

const originalEnv = process.env;

describe('lib/alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = 'test-key';
    process.env.ALERT_EMAIL = 'alerts@example.com';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exports sendAlert', async () => {
    const { sendAlert } = await import('@/lib/alerts');
    expect(typeof sendAlert).toBe('function');
  });

  it('sends email when ALERT_EMAIL and RESEND_API_KEY are set', async () => {
    const { sendAlert } = await import('@/lib/alerts');
    await sendAlert('TestService', 'Something broke', 'CRITICAL', { code: 500 });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const [opts] = mockSendEmail.mock.calls[0];
    expect(opts.to).toBe('alerts@example.com');
    expect(opts.subject).toContain('[CRITICAL]');
    expect(opts.subject).toContain('TestService');
    expect(opts.subject).toContain('Something broke');
    expect(opts.text).toContain('TestService');
    expect(opts.text).toContain('CRITICAL');
    expect(opts.text).toContain('Something broke');
    expect(opts.text).toContain('"code": 500');
  });

  it('does not send when ALERT_EMAIL is not set', async () => {
    delete process.env.ALERT_EMAIL;
    delete process.env.ALERTS_TO;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendAlert } = await import('@/lib/alerts');
    await sendAlert('Svc', 'Msg', 'WARNING');

    expect(mockSendEmail).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('uses ALERTS_TO when ALERT_EMAIL is not set', async () => {
    delete process.env.ALERT_EMAIL;
    process.env.ALERTS_TO = 'ops@example.com';

    const { sendAlert } = await import('@/lib/alerts');
    await sendAlert('Svc', 'Msg', 'INFO');

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].to).toBe('ops@example.com');
  });

  it('does not send when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { sendAlert } = await import('@/lib/alerts');
    await sendAlert('Svc', 'Msg', 'WARNING');

    expect(mockSendEmail).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('normalizes unknown severity to INFO', async () => {
    const { sendAlert } = await import('@/lib/alerts');
    await sendAlert('Svc', 'Msg', 'UNKNOWN');

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].subject).toContain('[INFO]');
  });

  it('does not throw when sendEmail throws', async () => {
    mockSendEmail.mockRejectedValueOnce(new Error('Resend failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { sendAlert } = await import('@/lib/alerts');
    await expect(sendAlert('Svc', 'Msg', 'CRITICAL')).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});
