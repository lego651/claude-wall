/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TradeLogModal from './TradeLogModal';

global.fetch = jest.fn();

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock TradeCard to keep modal tests focused
jest.mock('./TradeCard', () => function MockTradeCard({ trade }) {
  return <div data-testid="trade-card">{trade.symbol}</div>;
});

describe('TradeLogModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with header', () => {
    render(<TradeLogModal onClose={() => {}} />);
    expect(screen.getByText('Log a Trade')).toBeInTheDocument();
  });

  it('renders empty state message', () => {
    render(<TradeLogModal onClose={() => {}} />);
    expect(screen.getByText(/Describe your trade or upload a screenshot/i)).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(<TradeLogModal onClose={onClose} />);
    // Click the backdrop (first child of modal container)
    fireEvent.click(container.querySelector('.absolute.inset-0'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when × button is clicked', () => {
    const onClose = jest.fn();
    render(<TradeLogModal onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('send button is disabled when input is empty', () => {
    render(<TradeLogModal onClose={() => {}} />);
    expect(screen.getByLabelText('Send')).toBeDisabled();
  });

  it('send button is enabled when input has text', () => {
    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'bought EURUSD' } });
    expect(screen.getByLabelText('Send')).not.toBeDisabled();
  });

  it('shows trade card on successful parse response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ symbol: 'EURUSD', direction: 'buy', entry_price: 1.085 }),
    });

    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'bought EURUSD at 1.0850' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(screen.getByTestId('trade-card')).toBeInTheDocument();
    });
    expect(screen.getByText('EURUSD')).toBeInTheDocument();
  });

  it('shows refusal message for non-trade input', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ error: 'non_trade' }),
    });

    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: "what's the weather?" } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(screen.getByText(/only for logging trades/i)).toBeInTheDocument();
    });
  });

  it('shows error message on fetch failure', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy BTC' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('clears input after send', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ symbol: 'BTC', direction: 'buy' }),
    });

    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy BTC' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows generic error message for non-non_trade error responses', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'AI request failed' }),
    });

    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy BTC' } });
    fireEvent.click(screen.getByLabelText('Send'));

    await waitFor(() => {
      expect(screen.getByText(/Error: AI request failed/i)).toBeInTheDocument();
    });
  });

  it('sends message on Enter key press', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ symbol: 'GBPUSD', direction: 'buy' }),
    });

    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy GBPUSD' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(screen.getByTestId('trade-card')).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not send on Shift+Enter key press', () => {
    render(<TradeLogModal onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy GBPUSD' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('camera button triggers file input click', () => {
    render(<TradeLogModal onClose={() => {}} />);
    const fileInput = document.querySelector('input[type="file"]');
    const clickSpy = jest.spyOn(fileInput, 'click');

    fireEvent.click(screen.getByLabelText('Attach image'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('shows image preview after file selection', () => {
    global.URL.createObjectURL = jest.fn(() => 'blob:fake-url');

    render(<TradeLogModal onClose={() => {}} />);
    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['chart'], 'chart.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByAltText('Preview')).toBeInTheDocument();
  });
});
