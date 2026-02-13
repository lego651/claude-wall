/**
 * Request ID helper tests
 * PROP-004: Structured logging
 */

import { getRequestId, setRequestIdHeader, REQUEST_ID_HEADER } from './requestId';

describe('middleware/requestId', () => {
  it('returns existing x-request-id from request', () => {
    const request = { headers: { get: (k) => (k === 'x-request-id' ? 'existing-id' : null) } };
    expect(getRequestId(request)).toBe('existing-id');
  });

  it('generates UUID when header is missing', () => {
    const request = { headers: { get: () => null } };
    const id = getRequestId(request);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(10);
  });

  it('setRequestIdHeader sets on Headers object', () => {
    const headers = new Headers();
    setRequestIdHeader(headers, 'test-123');
    expect(headers.get('x-request-id')).toBe('test-123');
  });

  it('setRequestIdHeader sets on plain object', () => {
    const headers = {};
    setRequestIdHeader(headers, 'test-456');
    expect(headers['x-request-id']).toBe('test-456');
  });

  it('exports REQUEST_ID_HEADER', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });
});
