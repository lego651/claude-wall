/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MonthlyCalendar from './MonthlyCalendar';

const VIEW_MONTH = '2026-03';
const TODAY_DATE = '2026-03-20';

// Override the "today" used in the component by controlling Date
const MONTHLY_DATA = {
  month: '2026-03',
  pnl_unit: 'USD',
  monthly_pnl: 901.36,
  days: {
    '2026-03-18': { trade_count: 10, pnl: -1800.08 },
    '2026-03-20': { trade_count: 2, pnl: 901.36 },
  },
  weeks: [
    { week: 1, label: 'Week 1', trade_count: 0, pnl: null, saturday: '2026-03-07' },
    { week: 2, label: 'Week 2', trade_count: 0, pnl: null, saturday: '2026-03-14' },
    { week: 3, label: 'Week 3', trade_count: 12, pnl: -898.72, saturday: '2026-03-21' },
    { week: 4, label: 'Week 4', trade_count: 0, pnl: null, saturday: '2026-03-28' },
    { week: 5, label: 'Week 5', trade_count: 0, pnl: null, saturday: '2026-03-31' },
  ],
};

function renderCalendar(props = {}) {
  return render(
    <MonthlyCalendar
      monthlyData={MONTHLY_DATA}
      selectedDate={TODAY_DATE}
      onDayClick={jest.fn()}
      viewMonth={VIEW_MONTH}
      onMonthChange={jest.fn()}
      isLoading={false}
      {...props}
    />
  );
}

describe('MonthlyCalendar', () => {
  it('renders month label', () => {
    renderCalendar();
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });

  it('renders day of week headers', () => {
    renderCalendar();
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((d) => {
      expect(screen.getAllByText(d).length).toBeGreaterThan(0);
    });
  });

  it('renders monthly P&L header', () => {
    renderCalendar();
    const header = screen.getByText(/Monthly P&L:/);
    expect(header).toBeInTheDocument();
    expect(header.textContent).toMatch(/\+\$901/);
  });

  it('renders week labels', () => {
    renderCalendar();
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 3')).toBeInTheDocument();
  });

  it('calls onDayClick with correct date when day clicked', () => {
    const onDayClick = jest.fn();
    renderCalendar({ onDayClick });
    // Find a day button with label "2026-03-18"
    const dayBtn = screen.getByLabelText(/2026-03-18/);
    fireEvent.click(dayBtn);
    expect(onDayClick).toHaveBeenCalledWith('2026-03-18');
  });

  it('calls onMonthChange(-1) when prev arrow clicked', () => {
    const onMonthChange = jest.fn();
    renderCalendar({ onMonthChange });
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(onMonthChange).toHaveBeenCalledWith(-1);
  });

  it('calls onMonthChange(1) when next arrow clicked', () => {
    const onMonthChange = jest.fn();
    renderCalendar({ onMonthChange });
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(onMonthChange).toHaveBeenCalledWith(1);
  });

  it('renders null monthly_pnl as "—"', () => {
    renderCalendar({ monthlyData: { ...MONTHLY_DATA, monthly_pnl: null } });
    expect(screen.getByText(/Monthly P&L: —/)).toBeInTheDocument();
  });

  it('renders negative monthly_pnl in red class', () => {
    const { container } = renderCalendar({ monthlyData: { ...MONTHLY_DATA, monthly_pnl: -500 } });
    const header = screen.getByText(/Monthly P&L:/);
    expect(header.className).toContain('text-red-600');
  });

  it('renders positive monthly_pnl in green class', () => {
    renderCalendar();
    const header = screen.getByText(/Monthly P&L:/);
    expect(header.className).toContain('text-green-600');
  });

  it('renders without monthlyData (null)', () => {
    // Should not throw
    renderCalendar({ monthlyData: null });
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });
});
