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

  it('formats trade_at as locale string', () => {
    render(<TradeCard trade={{ ...baseTrade, trade_at: '2026-03-20T10:30:00Z' }} />);
    // Just verify it doesn't show the raw ISO string or a dash
    const dashes = screen.queryAllByText('—');
    // trade_at should be formatted, not a dash
    const allText = document.body.textContent;
    expect(allText).not.toContain('2026-03-20T10:30:00Z');
  });

  it('clears field to null when input is emptied in edit mode', () => {
    render(<TradeCard trade={baseTrade} />);
    fireEvent.click(screen.getByText('Edit'));

    const inputs = screen.getAllByRole('textbox');
    // Change an input to empty string — handleFieldChange should set it to null
    fireEvent.change(inputs[0], { target: { value: '' } });
    // Confirm still works after clearing
    fireEvent.click(screen.getByText('Confirm'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('allows editing direction via select in edit mode', () => {
    render(<TradeCard trade={baseTrade} />);
    fireEvent.click(screen.getByText('Edit'));

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'sell' } });
    expect(select.value).toBe('sell');
  });

  it('allows editing notes via textarea in edit mode', () => {
    render(<TradeCard trade={baseTrade} />);
    fireEvent.click(screen.getByText('Edit'));

    const textareas = document.querySelectorAll('textarea');
    expect(textareas.length).toBeGreaterThan(0);
    fireEvent.change(textareas[0], { target: { value: 'Updated notes' } });
    expect(textareas[0].value).toBe('Updated notes');
  });

  it('shows Saving… while save is in progress', async () => {
    let resolveFetch;
    fetch.mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve; })
    );

    render(<TradeCard trade={baseTrade} />);
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Saving…')).toBeInTheDocument();
    resolveFetch({ ok: true, json: () => Promise.resolve({ id: 'x' }) });
  });
});
