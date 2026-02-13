/**
 * Request ID helper for structured logging.
 * Use in API routes: const requestId = getRequestId(request); logger.child({ requestId }).info(...)
 */

const HEADER = 'x-request-id';

/**
 * Get or generate a request ID for this request.
 * In middleware we set x-request-id; otherwise a new UUID is generated.
 * @param {Request} request - Next.js request (has headers)
 * @returns {string}
 */
export function getRequestId(request) {
  if (!request?.headers) {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
  const id = request.headers.get(HEADER);
  if (id) return id;
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Add x-request-id to response headers (for client correlation).
 * @param {Headers|Record<string, string>} headers - Response headers to mutate
 * @param {string} requestId
 */
export function setRequestIdHeader(headers, requestId) {
  if (!headers || !requestId) return;
  if (typeof headers.set === 'function') {
    headers.set(HEADER, requestId);
  } else {
    headers[HEADER] = requestId;
  }
}

export { HEADER as REQUEST_ID_HEADER };
