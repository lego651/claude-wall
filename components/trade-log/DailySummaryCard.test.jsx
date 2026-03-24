/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import DailySummaryCard from './DailySummaryCard';

describe('DailySummaryCard', () => {
  it('renders logged count', () => {
    render(<DailySummaryCard tradesLogged={2} tradesRemaining={1} dailyLimit={3} />);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('Logged')).toBeInTheDocument();
  });

  it('renders P&L label', () => {
    render(<DailySummaryCard tradesLogged={1} tradesRemaining={2} dailyLimit={3} pnlTotal={2.0} pnlUnit="R" />);
    expect(screen.getByText('P&L')).toBeInTheDocument();
  });

  it('formats P&L as R', () => {
    render(<DailySummaryCard tradesLogged={1} tradesRemaining={2} dailyLimit={3} pnlTotal={2.0} pnlUnit="R" />);
    expect(screen.getByText('+2R')).toBeInTheDocument();
  });

  it('formats P&L as USD', () => {
    render(<DailySummaryCard tradesLogged={1} tradesRemaining={2} dailyLimit={3} pnlTotal={1000} pnlUnit="USD" />);
    expect(screen.getByText('+$1,000')).toBeInTheDocument();
  });

  it('formats negative P&L as USD', () => {
    render(<DailySummaryCard tradesLogged={1} tradesRemaining={2} dailyLimit={3} pnlTotal={-500} pnlUnit="USD" />);
    expect(screen.getByText('-$500')).toBeInTheDocument();
  });

  it('shows — when pnlTotal is null', () => {
    render(<DailySummaryCard tradesLogged={0} tradesRemaining={3} dailyLimit={3} pnlTotal={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows "Limit reached" when tradesRemaining is 0', () => {
    render(<DailySummaryCard tradesLogged={3} tradesRemaining={0} dailyLimit={3} />);
    expect(screen.getByText('Limit reached')).toBeInTheDocument();
  });

  it('does not show "Limit reached" when trades remain', () => {
    render(<DailySummaryCard tradesLogged={1} tradesRemaining={2} dailyLimit={3} />);
    expect(screen.queryByText('Limit reached')).not.toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<DailySummaryCard isLoading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('does not render skeleton when not loading', () => {
    const { container } = render(<DailySummaryCard tradesLogged={0} tradesRemaining={3} dailyLimit={3} />);
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });
});
