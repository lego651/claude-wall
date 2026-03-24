/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TradeLogModal from './TradeLogModal';

global.fetch = jest.fn();

// jsdom doesn't implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = jest.fn();

// Mock TradeCard to keep modal tests focused
jest.mock('./TradeCard', () => function MockTradeCard({ trade }) {
  return <div data-testid="trade-card">{trade.symbol}</div>;
});

const ACCOUNTS = [
  { id: 'acct-1', name: 'Default', is_default: true, pnl_unit: 'USD', created_at: '2026-01-01' },
];

const DAILY_TRADES = {
  date: '2026-03-20',
  daily_limit: 3,
  trades_logged: 1,
  trades_remaining: 2,
  pnl_total: null,
  pnl_unit: 'USD',
  trades: [
    { id: 'trade-1', symbol: 'EURUSD', direction: 'buy', entry_price: 1.085, trade_at: '2026-03-20T10:30:00Z', pnl: null, account_id: 'acct-1' },
  ],
};

function mockFetchSequence(responses) {
  let i = 0;
  fetch.mockImplementation(() => {
    const resp = responses[i++];
    if (!resp) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    return Promise.resolve(resp);
  });
}

describe('TradeLogModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: accounts fetch returns ACCOUNTS, subsequent fetches handled per test
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(ACCOUNTS) });
  });

  it('renders the modal with header', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    expect(screen.getByText('Log a Trade')).toBeInTheDocument();
  });

  it('renders empty state message', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    expect(screen.getByText(/Describe your trade or upload a screenshot/i)).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = jest.fn();
    const { container } = render(<TradeLogModal onClose={onClose} />);
    await act(async () => {});
    fireEvent.click(container.querySelector('.absolute.inset-0'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when × button is clicked', async () => {
    const onClose = jest.fn();
    await act(async () => { render(<TradeLogModal onClose={onClose} />); });
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('send button is disabled when input is empty', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    expect(screen.getByLabelText('Send')).toBeDisabled();
  });

  it('send button is enabled when input has text', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'bought EURUSD' } });
    expect(screen.getByLabelText('Send')).not.toBeDisabled();
  });

  it('renders account picker when accounts loaded', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => {
      expect(screen.getByLabelText('Trade account')).toBeInTheDocument();
    });
  });

  it('P&L field label shows unit based on selected account', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => {
      // aria-label on the input includes the unit
      expect(screen.getByRole('spinbutton', { name: /P&L/ })).toBeInTheDocument();
    });
  });

  it('shows trade card on successful new_trade parse response', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'new_trade', symbol: 'EURUSD', direction: 'buy', entry_price: 1.085 }) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => screen.getByLabelText('Trade account'));

    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'bought EURUSD at 1.0850' } });

    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => {
      expect(screen.getByTestId('trade-card')).toBeInTheDocument();
    });
  });

  it('shows refusal message for non-trade input', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ error: 'non_trade' }) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: "what's the weather?" } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => {
      expect(screen.getByText(/only for logging trades/i)).toBeInTheDocument();
    });
  });

  it('handles pnl_update with one matching trade — shows confirmation', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'pnl_update', symbol: 'EURUSD', pnl: 2.0 }) },
      { ok: true, json: () => Promise.resolve(DAILY_TRADES) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => screen.getByLabelText('Trade account'));

    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'EURUSD +2R' } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => {
      expect(screen.getByText(/Update EURUSD/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });
  });

  it('handles pnl_update confirm — calls PATCH', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'pnl_update', symbol: 'EURUSD', pnl: 2.0 }) },
      { ok: true, json: () => Promise.resolve(DAILY_TRADES) },
      { ok: true, json: () => Promise.resolve({ id: 'trade-1', pnl: 2.0 }) }, // PATCH
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => screen.getByLabelText('Trade account'));

    fireEvent.change(screen.getByPlaceholderText('Describe your trade…'), { target: { value: 'EURUSD +2R' } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => screen.getByRole('button', { name: 'Confirm' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm' })); });

    await waitFor(() => {
      expect(screen.getByText(/P&L updated/)).toBeInTheDocument();
    });
    // Verify PATCH was called
    const patchCall = fetch.mock.calls.find((c) => c[0].includes('trade-log/trade-1'));
    expect(patchCall).toBeTruthy();
    expect(patchCall[1].method).toBe('PATCH');
  });

  it('handles pnl_update cancel', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'pnl_update', symbol: 'EURUSD', pnl: 2.0 }) },
      { ok: true, json: () => Promise.resolve(DAILY_TRADES) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => screen.getByLabelText('Trade account'));

    fireEvent.change(screen.getByPlaceholderText('Describe your trade…'), { target: { value: 'EURUSD +2R' } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });

    await waitFor(() => {
      expect(screen.getByText('Cancelled.')).toBeInTheDocument();
    });
  });

  it('shows "no trade found" when pnl_update symbol has no match today', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'pnl_update', symbol: 'GBPUSD', pnl: 1.0 }) },
      { ok: true, json: () => Promise.resolve({ ...DAILY_TRADES, trades: [] }) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => screen.getByLabelText('Trade account'));

    fireEvent.change(screen.getByPlaceholderText('Describe your trade…'), { target: { value: 'GBPUSD +1R' } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => {
      expect(screen.getByText(/No GBPUSD trade found today/)).toBeInTheDocument();
    });
  });

  it('shows selection list when multiple matching trades', async () => {
    const multiTrades = {
      ...DAILY_TRADES,
      trades: [
        { id: 'trade-1', symbol: 'EURUSD', direction: 'buy', entry_price: 1.085, trade_at: '2026-03-20T09:00:00Z', pnl: null, account_id: 'acct-1' },
        { id: 'trade-2', symbol: 'EURUSD', direction: 'sell', entry_price: 1.090, trade_at: '2026-03-20T11:00:00Z', pnl: null, account_id: 'acct-1' },
      ],
    };

    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'pnl_update', symbol: 'EURUSD', pnl: 2.0 }) },
      { ok: true, json: () => Promise.resolve(multiTrades) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => screen.getByLabelText('Trade account'));

    fireEvent.change(screen.getByPlaceholderText('Describe your trade…'), { target: { value: 'EURUSD +2R' } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => {
      expect(screen.getByText(/Multiple EURUSD trades today/)).toBeInTheDocument();
    });
  });

  it('shows error message on fetch failure', async () => {
    let callCount = 0;
    fetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: true, json: () => Promise.resolve(ACCOUNTS) });
      return Promise.reject(new Error('Network error'));
    });

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    await waitFor(() => screen.getByLabelText('Trade account'));

    fireEvent.change(screen.getByPlaceholderText('Describe your trade…'), { target: { value: 'buy BTC' } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('clears input after send', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'new_trade', symbol: 'BTC', direction: 'buy' }) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy BTC' } });
    await act(async () => { fireEvent.click(screen.getByLabelText('Send')); });

    await waitFor(() => { expect(input.value).toBe(''); });
  });

  it('sends message on Enter key press', async () => {
    mockFetchSequence([
      { ok: true, json: () => Promise.resolve(ACCOUNTS) },
      { ok: true, json: () => Promise.resolve({ type: 'new_trade', symbol: 'GBPUSD', direction: 'buy' }) },
    ]);

    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy GBPUSD' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter', shiftKey: false }); });

    await waitFor(() => { expect(screen.getByTestId('trade-card')).toBeInTheDocument(); });
  });

  it('does not send on Shift+Enter key press', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    const input = screen.getByPlaceholderText('Describe your trade…');
    fireEvent.change(input, { target: { value: 'buy GBPUSD' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    // Only 1 fetch for accounts, no parse call
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('camera button triggers file input click', async () => {
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    const fileInput = document.querySelector('input[type="file"]');
    const clickSpy = jest.spyOn(fileInput, 'click');
    fireEvent.click(screen.getByLabelText('Attach image'));
    expect(clickSpy).toHaveBeenCalled();
  });

  it('shows image preview after file selection', async () => {
    global.URL.createObjectURL = jest.fn(() => 'blob:fake-url');
    await act(async () => { render(<TradeLogModal onClose={() => {}} />); });
    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(['chart'], 'chart.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByAltText('Preview')).toBeInTheDocument();
  });
});
