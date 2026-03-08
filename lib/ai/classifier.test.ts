/**
 * TICKET-S10-004: Tests for review classifier.
 * Verifies text-based classification (rating is not used as input signal).
 */

import { classifyReview, classifyReviewBatch } from './classifier';

const mockCreate = jest.fn();

jest.mock('./openai-client', () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

function makeCompletion(category: string, severity: string | null, confidence = 0.9, summary = 'Test summary.') {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ category, severity, confidence, summary }),
        },
      },
    ],
  };
}

describe('classifyReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('classifies a negative review with 5-star rating as negative (text wins over rating)', async () => {
    mockCreate.mockResolvedValueOnce(
      makeCompletion('payout_denied', 'high', 0.95, 'Reviewer claims payout was refused.')
    );

    const result = await classifyReview({
      rating: 5,
      title: 'Great at first',
      text: 'They refused to pay me out after I hit my target. Complete scam, money was withheld for no reason.',
    });

    expect(result.category).toBe('payout_denied');
    expect(result.category).not.toBe('positive_experience');
    expect(result.severity).toBe('high');
  });

  it('classifies a positive review correctly', async () => {
    mockCreate.mockResolvedValueOnce(
      makeCompletion('positive_experience', null, 0.9, 'Reviewer praises fast payouts.')
    );

    const result = await classifyReview({
      rating: 5,
      title: 'Excellent',
      text: 'Payout was processed in 2 hours. Great support team. Highly recommend!',
    });

    expect(result.category).toBe('positive_experience');
    expect(result.severity).toBeNull();
  });

  it('prompt does not include the star rating value', async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion('support_issue', 'medium'));

    await classifyReview({ rating: 1, title: 'Bad support', text: 'Support ignored my ticket for weeks.' });

    const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(promptSent).not.toMatch(/Rating:/);
    expect(promptSent).not.toMatch(/1\/5/);
    expect(promptSent).not.toMatch(/5\/5/);
  });

  it('works without a rating field', async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion('platform_technical_issue', 'medium'));

    const result = await classifyReview({
      title: 'Platform keeps crashing',
      text: 'The MT4 platform disconnects every 30 minutes and I lost trades.',
    });

    expect(result.category).toBe('platform_technical_issue');
  });

  it('returns confidence clamped between 0 and 1', async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion('neutral_mixed', null, 1.5));

    const result = await classifyReview({ text: 'Okay I guess.' });
    expect(result.confidence).toBe(1);
  });
});

describe('classifyReviewBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('batch prompt does not include star ratings', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              results: [
                { category: 'payout_denied', severity: 'high', confidence: 0.9, summary: 'Payout refused.' },
                { category: 'positive_experience', severity: null, confidence: 0.85, summary: 'Great firm.' },
              ],
            }),
          },
        },
      ],
    });

    await classifyReviewBatch([
      { rating: 5, title: 'Refused my payout', text: 'They denied my withdrawal after 3 weeks.' },
      { rating: 1, title: 'Amazing', text: 'Fast payouts and great support!' },
    ]);

    const promptSent: string = mockCreate.mock.calls[0][0].messages[0].content;
    expect(promptSent).not.toMatch(/Rating:/);
  });

  it('returns empty array for empty input', async () => {
    const results = await classifyReviewBatch([]);
    expect(results).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
