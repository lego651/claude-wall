/**
 * Jest Setup File
 *
 * Runs before each test file.
 * Configure global test environment settings here.
 */

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ARBISCAN_API_KEY = 'test-arbiscan-api-key';

// Set timezone for consistent date handling
process.env.TZ = 'UTC';

// Global test timeout (increase if needed for async operations)
jest.setTimeout(10000);

// Suppress console output during tests (code under test still runs normally)
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
