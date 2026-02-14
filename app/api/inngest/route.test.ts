/**
 * Tests for /api/inngest (Inngest serve handler)
 */
import { GET, POST, PUT } from './route';

describe('/api/inngest', () => {
  it('exports GET handler', () => {
    expect(typeof GET).toBe('function');
  });

  it('exports POST handler', () => {
    expect(typeof POST).toBe('function');
  });

  it('exports PUT handler', () => {
    expect(typeof PUT).toBe('function');
  });
});
