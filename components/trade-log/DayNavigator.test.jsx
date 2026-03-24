/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DayNavigator from './DayNavigator';

const TODAY = new Date().toISOString().substring(0, 10);

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().substring(0, 10);
}

const YESTERDAY = addDays(TODAY, -1);

describe('DayNavigator', () => {
  it('renders previous and next buttons', () => {
    render(<DayNavigator selectedDate={TODAY} onPrev={jest.fn()} onNext={jest.fn()} onLabelClick={jest.fn()} />);
    expect(screen.getByLabelText('Previous day')).toBeInTheDocument();
    expect(screen.getByLabelText('Next day')).toBeInTheDocument();
  });

  it('shows "Today" when selectedDate is today', () => {
    render(<DayNavigator selectedDate={TODAY} onPrev={jest.fn()} onNext={jest.fn()} onLabelClick={jest.fn()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows formatted date when selectedDate is not today', () => {
    render(<DayNavigator selectedDate={YESTERDAY} onPrev={jest.fn()} onNext={jest.fn()} onLabelClick={jest.fn()} />);
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
  });

  it('next button is disabled when selectedDate is today', () => {
    render(<DayNavigator selectedDate={TODAY} onPrev={jest.fn()} onNext={jest.fn()} onLabelClick={jest.fn()} />);
    expect(screen.getByLabelText('Next day')).toBeDisabled();
  });

  it('next button is enabled when selectedDate is not today', () => {
    render(<DayNavigator selectedDate={YESTERDAY} onPrev={jest.fn()} onNext={jest.fn()} onLabelClick={jest.fn()} />);
    expect(screen.getByLabelText('Next day')).not.toBeDisabled();
  });

  it('calls onPrev when < clicked', () => {
    const onPrev = jest.fn();
    render(<DayNavigator selectedDate={TODAY} onPrev={onPrev} onNext={jest.fn()} onLabelClick={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Previous day'));
    expect(onPrev).toHaveBeenCalled();
  });

  it('calls onNext when > clicked (not today)', () => {
    const onNext = jest.fn();
    render(<DayNavigator selectedDate={YESTERDAY} onPrev={jest.fn()} onNext={onNext} onLabelClick={jest.fn()} />);
    fireEvent.click(screen.getByLabelText('Next day'));
    expect(onNext).toHaveBeenCalled();
  });

  it('calls onLabelClick when center label clicked', () => {
    const onLabelClick = jest.fn();
    render(<DayNavigator selectedDate={TODAY} onPrev={jest.fn()} onNext={jest.fn()} onLabelClick={onLabelClick} />);
    fireEvent.click(screen.getByLabelText('Select date'));
    expect(onLabelClick).toHaveBeenCalled();
  });
});
