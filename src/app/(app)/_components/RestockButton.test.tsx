import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RestockButton from './RestockButton';

vi.mock('../actions', () => ({
  restockProductAction: vi.fn().mockResolvedValue({}),
}));

import { restockProductAction } from '../actions';

describe('RestockButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the restock button', () => {
    render(<RestockButton productId="p-1" />);
    expect(screen.getByRole('button', { name: /agregar/i })).toBeInTheDocument();
  });

  it('clicking calls restockProductAction with the productId', async () => {
    render(<RestockButton productId="p-1" />);
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
    await waitFor(() => {
      expect(restockProductAction).toHaveBeenCalledWith('p-1');
    });
  });

  it('shows error message when action returns an error', async () => {
    vi.mocked(restockProductAction).mockResolvedValue({ error: 'Error al agregar' });
    render(<RestockButton productId="p-1" />);
    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));
    await waitFor(() => {
      expect(screen.getByText('Error al agregar')).toBeInTheDocument();
    });
  });

  it('button is not disabled when not pending', () => {
    render(<RestockButton productId="p-1" />);
    expect(screen.getByRole('button', { name: /agregar/i })).not.toBeDisabled();
  });
});
