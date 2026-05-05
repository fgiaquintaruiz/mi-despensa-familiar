import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConsumeButton from './ConsumeButton';

vi.mock('../actions', () => ({
  consumeProductAction: vi.fn().mockResolvedValue({}),
}));

import { consumeProductAction } from '../actions';

describe('ConsumeButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the consume button', () => {
    render(<ConsumeButton productId="p-1" currentStock={3} />);
    expect(screen.getByRole('button', { name: /consumir/i })).toBeInTheDocument();
  });

  it('button is disabled when currentStock is 0', () => {
    render(<ConsumeButton productId="p-1" currentStock={0} />);
    expect(screen.getByRole('button', { name: /consumir/i })).toBeDisabled();
  });

  it('clicking with stock > 0 calls consumeProductAction with the productId', async () => {
    render(<ConsumeButton productId="p-1" currentStock={3} />);
    fireEvent.click(screen.getByRole('button', { name: /consumir/i }));
    await waitFor(() => {
      expect(consumeProductAction).toHaveBeenCalledWith('p-1');
    });
  });

  it('does not call consumeProductAction when stock is 0', () => {
    render(<ConsumeButton productId="p-1" currentStock={0} />);
    fireEvent.click(screen.getByRole('button', { name: /consumir/i }));
    expect(consumeProductAction).not.toHaveBeenCalled();
  });

  it('shows error message when action returns an error', async () => {
    vi.mocked(consumeProductAction).mockResolvedValue({ error: 'Stock insuficiente' });
    render(<ConsumeButton productId="p-1" currentStock={3} />);
    fireEvent.click(screen.getByRole('button', { name: /consumir/i }));
    await waitFor(() => {
      expect(screen.getByText('Stock insuficiente')).toBeInTheDocument();
    });
  });

  it('error message is not visible by default', () => {
    render(<ConsumeButton productId="p-1" currentStock={3} />);
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });
});
