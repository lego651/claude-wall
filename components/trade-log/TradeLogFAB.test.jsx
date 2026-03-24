/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TradeLogFAB from './TradeLogFAB';

jest.mock('./TradeLogModal', () => function MockModal({ onClose }) {
  return (
    <div data-testid="trade-log-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  );
});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

const { createClient } = require('@/lib/supabase/client');

function mockAuthUser(user = { id: 'user-123' }) {
  createClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  });
}

describe('TradeLogFAB', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the FAB button', async () => {
    mockAuthUser();
    await act(async () => {
      render(<TradeLogFAB />);
    });
    expect(screen.getByLabelText('Log a trade')).toBeInTheDocument();
    expect(screen.getByText('Log Trade')).toBeInTheDocument();
  });

  it('modal is not shown initially', async () => {
    mockAuthUser();
    await act(async () => {
      render(<TradeLogFAB />);
    });
    expect(screen.queryByTestId('trade-log-modal')).not.toBeInTheDocument();
  });

  it('opens modal on FAB click when logged in', async () => {
    mockAuthUser();
    await act(async () => {
      render(<TradeLogFAB />);
    });
    fireEvent.click(screen.getByLabelText('Log a trade'));
    expect(screen.getByTestId('trade-log-modal')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to /signin when not logged in', async () => {
    mockAuthUser(null);
    await act(async () => {
      render(<TradeLogFAB />);
    });
    fireEvent.click(screen.getByLabelText('Log a trade'));
    expect(mockPush).toHaveBeenCalledWith('/signin');
    expect(screen.queryByTestId('trade-log-modal')).not.toBeInTheDocument();
  });

  it('closes modal when onClose is called', async () => {
    mockAuthUser();
    await act(async () => {
      render(<TradeLogFAB />);
    });
    fireEvent.click(screen.getByLabelText('Log a trade'));
    expect(screen.getByTestId('trade-log-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close Modal'));
    expect(screen.queryByTestId('trade-log-modal')).not.toBeInTheDocument();
  });
});
