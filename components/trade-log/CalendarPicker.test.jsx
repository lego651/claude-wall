/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarPicker from './CalendarPicker';

const VIEW_MONTH = '2026-03';
const SELECTED = '2026-03-20';
const MONTHLY_DATA = {
  days: {
    '2026-03-18': { trade_count: 2, pnl: -100 },
    '2026-03-20': { trade_count: 1, pnl: 200 },
    '2026-03-19': { trade_count: 1, pnl: null },
  },
};

function renderPicker(props = {}) {
  return render(
    <CalendarPicker
      selectedDate={SELECTED}
      monthlyData={MONTHLY_DATA}
      viewMonth={VIEW_MONTH}
      onSelectDate={jest.fn()}
      onMonthChange={jest.fn()}
      onClose={jest.fn()}
      {...props}
    />
  );
}

describe('CalendarPicker', () => {
  it('renders as bottom sheet with backdrop', () => {
    renderPicker();
    expect(screen.getByTestId('calendar-picker')).toBeInTheDocument();
  });

  it('renders month label', () => {
    renderPicker();
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });

  it('renders day of week headers', () => {
    renderPicker();
    ['Su', 'Mo', 'Tu', 'We', 'Th'].forEach((d) => {
      expect(screen.getAllByText(d).length).toBeGreaterThan(0);
    });
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = jest.fn();
    renderPicker({ onClose });
    fireEvent.click(screen.getByLabelText('Close calendar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSelectDate and onClose when day clicked', () => {
    const onSelectDate = jest.fn();
    const onClose = jest.fn();
    renderPicker({ onSelectDate, onClose });
    fireEvent.click(screen.getByLabelText('2026-03-15'));
    expect(onSelectDate).toHaveBeenCalledWith('2026-03-15');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onMonthChange(-1) on prev arrow', () => {
    const onMonthChange = jest.fn();
    renderPicker({ onMonthChange });
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(onMonthChange).toHaveBeenCalledWith(-1);
  });

  it('calls onMonthChange(1) on next arrow', () => {
    const onMonthChange = jest.fn();
    renderPicker({ onMonthChange });
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(onMonthChange).toHaveBeenCalledWith(1);
  });

  it('today button triggers onMonthChange(0)', () => {
    const onMonthChange = jest.fn();
    renderPicker({ onMonthChange });
    fireEvent.click(screen.getByLabelText('Today'));
    expect(onMonthChange).toHaveBeenCalledWith(0);
  });

  it('shows green dot for profitable day', () => {
    const { container } = renderPicker();
    // 2026-03-20 has pnl: 200 → green dot
    const cell = screen.getByLabelText('2026-03-20');
    const dot = cell.querySelector('.bg-green-500');
    expect(dot).toBeInTheDocument();
  });

  it('shows red dot for losing day', () => {
    renderPicker();
    const cell = screen.getByLabelText('2026-03-18');
    const dot = cell.querySelector('.bg-red-500');
    expect(dot).toBeInTheDocument();
  });

  it('shows gray dot for day with trades but no pnl', () => {
    renderPicker();
    const cell = screen.getByLabelText('2026-03-19');
    const dot = cell.querySelector('.bg-gray-400');
    expect(dot).toBeInTheDocument();
  });

  it('no dot for days with no trades', () => {
    renderPicker();
    const cell = screen.getByLabelText('2026-03-05');
    const dot = cell.querySelector('[class*="bg-"]');
    expect(dot).not.toBeInTheDocument();
  });

  it('handles null monthlyData gracefully', () => {
    renderPicker({ monthlyData: null });
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });
});
