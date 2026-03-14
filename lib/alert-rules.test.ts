import {
  SCRAPER_STALE_HOURS,
  CLASSIFIER_BACKLOG_THRESHOLD,
  EMAIL_INGEST_STALE_MINUTES,
  PIPELINE_ERROR_THRESHOLD,
  PAYOUT_ZERO_FIRM_MIN_AGE_DAYS,
} from './alert-rules';

describe('alert-rules constants', () => {
  it('SCRAPER_STALE_HOURS is 25', () => {
    expect(SCRAPER_STALE_HOURS).toBe(25);
  });

  it('CLASSIFIER_BACKLOG_THRESHOLD is 500', () => {
    expect(CLASSIFIER_BACKLOG_THRESHOLD).toBe(500);
  });

  it('EMAIL_INGEST_STALE_MINUTES is 60', () => {
    expect(EMAIL_INGEST_STALE_MINUTES).toBe(60);
  });

  it('PIPELINE_ERROR_THRESHOLD is 0', () => {
    expect(PIPELINE_ERROR_THRESHOLD).toBe(0);
  });

  it('PAYOUT_ZERO_FIRM_MIN_AGE_DAYS is 7', () => {
    expect(PAYOUT_ZERO_FIRM_MIN_AGE_DAYS).toBe(7);
  });

  it('all constants are numbers', () => {
    expect(typeof SCRAPER_STALE_HOURS).toBe('number');
    expect(typeof CLASSIFIER_BACKLOG_THRESHOLD).toBe('number');
    expect(typeof EMAIL_INGEST_STALE_MINUTES).toBe('number');
    expect(typeof PIPELINE_ERROR_THRESHOLD).toBe('number');
    expect(typeof PAYOUT_ZERO_FIRM_MIN_AGE_DAYS).toBe('number');
  });
});
