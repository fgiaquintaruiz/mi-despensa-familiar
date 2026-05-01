import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteProductButton from './DeleteProductButton';

vi.mock('../actions', () => ({
  deleteProductAction: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

import { deleteProductAction } from '../actions';
import { useRouter } from 'next/navigation';

describe('DeleteProductButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the delete button', () => {
    render(<DeleteProductButton productId="p-1" productName="Arroz" />);
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument();
  });

  it('clicking the delete button shows the confirm dialog with the product name', () => {
    render(<DeleteProductButton productId="p-1" productName="Arroz" />);
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    expect(screen.getByText(/Arroz/)).toBeInTheDocument();
    expect(screen.getByText(/No se puede deshacer/i)).toBeInTheDocument();
  });

  it('clicking Cancelar closes the dialog without calling the action', () => {
    render(<DeleteProductButton productId="p-1" productName="Arroz" />);
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByText(/No se puede deshacer/i)).not.toBeInTheDocument();
    expect(deleteProductAction).not.toHaveBeenCalled();
  });

  it('clicking Eliminar in the dialog calls deleteProductAction with the correct productId', async () => {
    render(<DeleteProductButton productId="p-1" productName="Arroz" />);
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /eliminar/i });
    const confirmBtn = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(deleteProductAction).toHaveBeenCalledWith('p-1');
    });
  });

  it('calls router.refresh() after successful delete', async () => {
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), refresh: mockRefresh } as ReturnType<typeof useRouter>);
    render(<DeleteProductButton productId="p-1" productName="Arroz" />);
    fireEvent.click(screen.getByRole('button', { name: /eliminar/i }));
    const confirmButtons = screen.getAllByRole('button', { name: /eliminar/i });
    const confirmBtn = confirmButtons[confirmButtons.length - 1];
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
