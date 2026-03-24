/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TradeEditModal from './TradeEditModal';

global.fetch = jest.fn();

const ACCOUNTS = [
  { id: 'acct-1', name: 'Default', is_default: true, pnl_unit: 'USD' },
  { id: 'acct-2', name: 'Funded R', is_default: false, pnl_unit: 'R' },
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
};

function renderModal(props = {}) {
  return render(
    <TradeEditModal
      trade={TRADE}
      accounts={ACCOUNTS}
      onSave={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />
  );
}

describe('TradeEditModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders Edit Trade heading', () => {
    renderModal();
    expect(screen.getByText('Edit Trade')).toBeInTheDocument();
  });

  it('pre-fills symbol', () => {
    renderModal();
    expect(screen.getByDisplayValue('EURUSD')).toBeInTheDocument();
  });

  it('pre-fills P&L', () => {
    renderModal();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when × clicked', () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error when symbol empty', async () => {
    renderModal();
    const symbolInput = screen.getByDisplayValue('EURUSD');
    fireEvent.change(symbolInput, { target: { value: '' } });
    await act(async () => { fireEvent.click(screen.getByText('Save')); });
    expect(screen.getByText('Symbol is required')).toBeInTheDocument();
  });

  it('calls PATCH on save and calls onSave', async () => {
    const updatedTrade = { ...TRADE, pnl: 3.0 };
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updatedTrade) });
    const onSave = jest.fn();
    renderModal({ onSave });

    await act(async () => { fireEvent.click(screen.getByText('Save')); });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(updatedTrade));
    expect(fetch).toHaveBeenCalledWith(
      '/api/trade-log/trade-1',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('sends pnl: null when P&L field is blank', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ...TRADE, pnl: null }) });
    renderModal({ trade: { ...TRADE, pnl: null } });

    await act(async () => { fireEvent.click(screen.getByText('Save')); });

    await waitFor(() => {
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.pnl).toBeNull();
    });
  });

  it('shows error on PATCH failure', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: 'Not found' }) });
    renderModal();

    await act(async () => { fireEvent.click(screen.getByText('Save')); });

    await waitFor(() => expect(screen.getByText('Not found')).toBeInTheDocument());
  });

  it('P&L label shows unit based on selected account (USD)', () => {
    renderModal();
    // Default account is USD
    expect(screen.getByText(/P&L \(\$/)).toBeInTheDocument();
  });

  it('P&L label changes when account changes to R', () => {
    renderModal();
    // The account select contains the account names
    const selects = screen.getAllByRole('combobox');
    const acctSel = selects.find((s) => s.textContent.includes('Default') && s.textContent.includes('Funded'));
    expect(acctSel).toBeTruthy();
    fireEvent.change(acctSel, { target: { value: 'acct-2' } });
    expect(screen.getByText(/P&L \(R\)/)).toBeInTheDocument();
  });

  it('renders without accounts gracefully', () => {
    renderModal({ accounts: [] });
    expect(screen.getByText('Edit Trade')).toBeInTheDocument();
  });
});
