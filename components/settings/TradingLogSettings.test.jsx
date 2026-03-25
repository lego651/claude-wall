/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TradingLogSettings from './TradingLogSettings';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));
const toast = require('react-hot-toast');

const ACCOUNTS = [
  { id: 'acct-1', name: 'Default', is_default: true, pnl_unit: 'USD', created_at: '2026-01-01' },
  { id: 'acct-2', name: 'Funded A', is_default: false, pnl_unit: 'R', created_at: '2026-01-02' },
];

function mockFetch(responses) {
  let callIndex = 0;
  global.fetch = jest.fn().mockImplementation((url, opts) => {
    // Match by URL pattern
    if (url.includes('/api/user-settings/trading') && (!opts || opts.method === undefined || opts.method === 'GET')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ daily_trade_limit: 3 }) });
    }
    if (url.includes('/api/trade-accounts') && (!opts || !opts.method || opts.method === 'GET')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ACCOUNTS) });
    }
    // For other calls, use provided responses
    const response = responses[callIndex++] || { ok: true, json: () => Promise.resolve({}) };
    return Promise.resolve(response);
  });
}

describe('TradingLogSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch([]);
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('renders the Trading Log section heading', async () => {
    await act(async () => {
      render(<TradingLogSettings />);
    });
    expect(screen.getByText('Trading Log')).toBeInTheDocument();
  });

  it('loads and displays accounts', async () => {
    await act(async () => {
      render(<TradingLogSettings />);
    });
    await waitFor(() => {
      expect(screen.getAllByText('Default').length).toBeGreaterThan(0);
      expect(screen.getByText('Funded A')).toBeInTheDocument();
    });
  });

  it('shows Default badge on default account', async () => {
    await act(async () => {
      render(<TradingLogSettings />);
    });
    await waitFor(() => {
      const defaultBadge = screen.getAllByText('Default').find(
        (el) => el.tagName === 'SPAN'
      );
      expect(defaultBadge).toBeTruthy();
    });
  });

  it('shows pnl_unit badges', async () => {
    await act(async () => {
      render(<TradingLogSettings />);
    });
    await waitFor(() => {
      expect(screen.getByText('$')).toBeInTheDocument(); // USD badge
      expect(screen.getByText('R')).toBeInTheDocument(); // R badge
    });
  });

  it('adds a new account', async () => {
    const newAcct = { id: 'acct-3', name: 'Test', is_default: false, pnl_unit: 'R', created_at: '2026-01-03' };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ACCOUNTS) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(newAcct) });

    await act(async () => {
      render(<TradingLogSettings />);
    });

    await waitFor(() => screen.getByText('Funded A'));

    fireEvent.change(screen.getByPlaceholderText('Enter account name...'), { target: { value: 'Test' } });
    // Switch to R - find by value
    const rRadio = screen.getByDisplayValue('R');
    fireEvent.click(rRadio);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Account' }));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Account created');
    });
  });

  it('shows delete confirm for non-default account', async () => {
    await act(async () => {
      render(<TradingLogSettings />);
    });

    await waitFor(() => screen.getByText('Funded A'));

    const deleteBtn = screen.getByLabelText('Delete Funded A');
    fireEvent.click(deleteBtn);

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('cancels delete on Cancel click', async () => {
    await act(async () => {
      render(<TradingLogSettings />);
    });

    await waitFor(() => screen.getByText('Funded A'));

    fireEvent.click(screen.getByLabelText('Delete Funded A'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('deletes non-default account', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ACCOUNTS) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });

    await act(async () => {
      render(<TradingLogSettings />);
    });

    await waitFor(() => screen.getByText('Funded A'));

    fireEvent.click(screen.getByLabelText('Delete Funded A'));

    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Account deleted');
    });
    expect(screen.queryByText('Funded A')).not.toBeInTheDocument();
  });

  it('sets account as default', async () => {
    const updated = { ...ACCOUNTS[1], is_default: true };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ACCOUNTS) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updated) });

    await act(async () => {
      render(<TradingLogSettings />);
    });

    await waitFor(() => screen.getByTitle('Set as default'));

    await act(async () => {
      fireEvent.click(screen.getByTitle('Set as default'));
    });

    // After setting default, the account should update
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/trade-accounts/acct-2',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('shows warning about immutable pnl_unit', async () => {
    await act(async () => {
      render(<TradingLogSettings />);
    });
    expect(screen.getByText('Cannot be changed after creation.')).toBeInTheDocument();
  });
});
