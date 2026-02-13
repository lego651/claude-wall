/**
 * Structured logger (pino) for API and services.
 * Use child loggers to add context: requestId, userId, firmId.
 * Production: JSON output. Development: JSON (set LOG_LEVEL=debug for more).
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
const base = pino({
  level,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with optional context (requestId, userId, firmId).
 * @param {object} bindings - { requestId?, userId?, firmId?, ... }
 * @returns {pino.Logger}
 */
export function createLogger(bindings = {}) {
  return base.child(bindings);
}

/** Default logger (no request context). Use in services/cron. */
export const logger = base;

export default logger;
