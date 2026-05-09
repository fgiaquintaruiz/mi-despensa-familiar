import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteTransactionButton from './DeleteTransactionButton';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({ refresh: vi.fn() }),
}));

vi.mock('../actions', () => ({
  softDeleteTransactionAction: vi.fn(),
}));

describe('DeleteTransactionButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders delete button with Trash2 icon and aria-label', () => {
    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    const btn = screen.getByRole('button', { name: /eliminar gasto/i });
    expect(btn).toBeInTheDocument();
    // Must NOT contain text "Eliminar" — replaced by icon
    expect(btn).not.toHaveTextContent('Eliminar');
    // Must have the svg icon inside
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('opens dialog on click', () => {
    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/eliminar este gasto/i)).toBeInTheDocument();
  });

  it('shows store name and amount in dialog subtitle', () => {
    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));
    expect(screen.getByText(/carrefour/i)).toBeInTheDocument();
  });

  it('shows "(Sin tienda)" when storeName is null', () => {
    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName={null}
        totalAmount={100}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));
    expect(screen.getByText(/sin tienda/i)).toBeInTheDocument();
  });

  it('checkbox is unchecked by default', () => {
    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('checkbox label text is visible in dialog', () => {
    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));
    expect(screen.getByText(/también quitar los productos del stock/i)).toBeInTheDocument();
  });

  it('calls softDeleteTransactionAction with removeStock=false when checkbox unchecked', async () => {
    const { softDeleteTransactionAction } = await import('../actions');
    vi.mocked(softDeleteTransactionAction).mockResolvedValue({});

    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));

    // Click the confirm "Eliminar" button inside the dialog
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(softDeleteTransactionAction).toHaveBeenCalledWith('tx-1', false);
    });
  });

  it('calls softDeleteTransactionAction with removeStock=true when checkbox checked', async () => {
    const { softDeleteTransactionAction } = await import('../actions');
    vi.mocked(softDeleteTransactionAction).mockResolvedValue({});

    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(softDeleteTransactionAction).toHaveBeenCalledWith('tx-1', true);
    });
  });

  it('closes dialog and refreshes on success', async () => {
    const { useRouter } = await import('next/navigation');
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh: mockRefresh } as unknown as ReturnType<typeof useRouter>);

    const { softDeleteTransactionAction } = await import('../actions');
    vi.mocked(softDeleteTransactionAction).mockResolvedValue({});

    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('shows error message when action returns error', async () => {
    const { softDeleteTransactionAction } = await import('../actions');
    vi.mocked(softDeleteTransactionAction).mockResolvedValue({ error: 'Algo salió mal' });

    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    });
    // Dialog stays open on error
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows friendly message and refreshes list when action returns code=transaction_gone', async () => {
    const { useRouter } = await import('next/navigation');
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ refresh: mockRefresh } as unknown as ReturnType<typeof useRouter>);

    const { softDeleteTransactionAction } = await import('../actions');
    vi.mocked(softDeleteTransactionAction).mockResolvedValue({
      error: 'Este gasto ya no existe. Refrescá la pantalla.',
      code: 'transaction_gone',
    });

    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(screen.getByText('Este gasto ya no existe. Refrescá la pantalla.')).toBeInTheDocument();
    });
    // Stale row should be cleared by refreshing the RSC tree
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('closes dialog when Cancelar is clicked', () => {
    render(
      <DeleteTransactionButton
        transactionId="tx-1"
        storeName="Carrefour"
        totalAmount={420}
        currency="EUR"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /eliminar gasto/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
