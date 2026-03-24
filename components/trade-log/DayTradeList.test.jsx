/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DayTradeList from './DayTradeList';

global.fetch = jest.fn();

jest.mock('./TradeEditModal', () => function MockEditModal({ onClose, onSave }) {
  return (
    <div data-testid="edit-modal">
      <button onClick={onClose}>Close Edit</button>
      <button onClick={() => onSave({ id: 'trade-1', symbol: 'EURUSD', pnl: 2.0 })}>Save Edit</button>
    </div>
  );
});

const ACCOUNTS = [
  { id: 'acct-1', name: 'Default', is_default: true, pnl_unit: 'USD' },
];
const TRADE = {
  id: 'trade-1',
  symbol: 'EURUSD',
  direction: 'buy',
  entry_price: 1.085,
  stop_loss: 1.082,
  take_profit: 1.092,
  lots: 0.1,
  risk_reward: 2.33,
  trade_at: '2026-03-20T10:30:00Z',
  notes: 'test note',
  pnl: 2.0,
  account_id: 'acct-1',
  account_name: 'Default',
  pnl_unit: 'USD',
};

describe('DayTradeList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows empty state when no trades', () => {
    render(<DayTradeList trades={[]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    expect(screen.getByText(/No trades logged for this day/)).toBeInTheDocument();
  });

  it('shows loading skeletons', () => {
    const { container } = render(<DayTradeList trades={[]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders trade row with symbol and direction', () => {
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    expect(screen.getByText('EURUSD')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
  });

  it('expands trade row on click', () => {
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    expect(screen.getByText('P&L:')).toBeInTheDocument();
  });

  it('shows P&L in expanded view', () => {
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    expect(screen.getByText('+$2')).toBeInTheDocument();
  });

  it('shows — for null pnl', () => {
    const trade = { ...TRADE, pnl: null };
    render(<DayTradeList trades={[trade]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows delete confirmation on Delete click', () => {
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/Delete this trade?/)).toBeInTheDocument();
  });

  it('calls onDeleted after confirming delete', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) });
    const onDeleted = jest.fn();
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={onDeleted} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('trade-1'));
  });

  it('cancels delete on No click', () => {
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByText(/Delete this trade?/)).not.toBeInTheDocument();
  });

  it('opens edit modal on Edit click', () => {
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
  });

  it('calls onUpdated when edit modal saves', () => {
    const onUpdated = jest.fn();
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={onUpdated} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByText('Save Edit'));
    expect(onUpdated).toHaveBeenCalledWith({ id: 'trade-1', symbol: 'EURUSD', pnl: 2.0 });
  });

  it('closes edit modal on Close', () => {
    render(<DayTradeList trades={[TRADE]} accounts={ACCOUNTS} onUpdated={jest.fn()} onDeleted={jest.fn()} />);
    const rowBtn = screen.getAllByRole('button').find((b) => b.textContent.includes('EURUSD'));
    fireEvent.click(rowBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByText('Close Edit'));
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
  });
});
