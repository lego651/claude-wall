/**
 * Logger configuration tests
 * PROP-004: Structured logging
 */

import { createLogger, logger } from '@/lib/logger';

describe('lib/logger', () => {
  it('exports logger with standard levels', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('createLogger returns a child with bindings', () => {
    const child = createLogger({ requestId: 'test-123', firmId: 'firm-a' });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
    // Child should not throw when logging
    expect(() => child.info('test message')).not.toThrow();
  });

  it('logger.info accepts message and optional object', () => {
    expect(() => logger.info('msg')).not.toThrow();
    expect(() => logger.info({ key: 'value' }, 'msg')).not.toThrow();
  });

  it('logger.error accepts message and optional object', () => {
    expect(() => logger.error('err')).not.toThrow();
    expect(() => logger.error({ err: new Error('test') }, 'err')).not.toThrow();
  });
});
