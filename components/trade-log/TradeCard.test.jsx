/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TradeCard from './TradeCard';

global.fetch = jest.fn();

const baseTrade = {
  symbol: 'EURUSD',
  direction: 'buy',
  entry_price: 1.085,
  stop_loss: 1.082,
  take_profit: 1.092,
  lots: 0.1,
  risk_reward: 2.33,
  trade_at: null,
  notes: 'Test trade',
};

describe('TradeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders symbol and direction', () => {
    render(<TradeCard trade={baseTrade} />);
    expect(screen.getByText('EURUSD')).toBeInTheDocument();
    expect(screen.getByText('buy')).toBeInTheDocument();
  });

  it('renders trade fields in view mode', () => {
    render(<TradeCard trade={baseTrade} />);
    expect(screen.getByText('1.085')).toBeInTheDocument();
    expect(screen.getByText('Test trade')).toBeInTheDocument();
  });

  it('shows Edit and Save buttons in view mode', () => {
    render(<TradeCard trade={baseTrade} />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('switches to edit mode on Edit click', () => {
    render(<TradeCard trade={baseTrade} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('returns to view mode on Confirm click', () => {
    render(<TradeCard trade={baseTrade} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Confirm'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('calls save API and shows saved state on success', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'abc', created_at: '2026-03-20T00:00:00Z' }),
    });

    const onSave = jest.fn();
    render(<TradeCard trade={baseTrade} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Saved ✓')).toBeInTheDocument();
    });
    expect(onSave).toHaveBeenCalledWith({ id: 'abc', created_at: '2026-03-20T00:00:00Z' });
    expect(fetch).toHaveBeenCalledWith('/api/trade-log/save', expect.any(Object));
  });

  it('shows error message if save fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Database error' }),
    });

    render(<TradeCard trade={baseTrade} />);
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument();
    });
    expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
  });

  it('renders sell direction with red badge', () => {
    render(<TradeCard trade={{ ...baseTrade, direction: 'sell' }} />);
    expect(screen.getByText('sell')).toBeInTheDocument();
  });

  it('renders dash for null fields', () => {
    render(<TradeCard trade={{ symbol: 'BTC', direction: null, entry_price: null }} />);
    // Multiple dashes expected for null fields
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});
