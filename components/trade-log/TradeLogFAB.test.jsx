/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TradeLogFAB from './TradeLogFAB';

jest.mock('./TradeLogModal', () => function MockModal({ onClose }) {
  return (
    <div data-testid="trade-log-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  );
});

describe('TradeLogFAB', () => {
  it('renders the FAB button', () => {
    render(<TradeLogFAB />);
    expect(screen.getByLabelText('Log a trade')).toBeInTheDocument();
    expect(screen.getByText('Log Trade')).toBeInTheDocument();
  });

  it('modal is not shown initially', () => {
    render(<TradeLogFAB />);
    expect(screen.queryByTestId('trade-log-modal')).not.toBeInTheDocument();
  });

  it('opens modal on FAB click', () => {
    render(<TradeLogFAB />);
    fireEvent.click(screen.getByLabelText('Log a trade'));
    expect(screen.getByTestId('trade-log-modal')).toBeInTheDocument();
  });

  it('closes modal when onClose is called', () => {
    render(<TradeLogFAB />);
    fireEvent.click(screen.getByLabelText('Log a trade'));
    expect(screen.getByTestId('trade-log-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Modal'));
    expect(screen.queryByTestId('trade-log-modal')).not.toBeInTheDocument();
  });
});
