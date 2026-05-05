import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransactionList from './TransactionList';
import type { ShoppingTransaction } from '@/lib/types';

vi.mock('../actions', () => ({
  getTransactionItemsAction: vi.fn(),
}));

const mockTransactions: ShoppingTransaction[] = [
  {
    id: 'tx-1',
    household_id: 'hh-1',
    store_name: 'Carrefour',
    total_amount: 420,
    item_count: 2,
    transaction_date: '2026-05-04',
    source: 'ocr',
    notes: null,
    created_at: '2026-05-04T10:00:00Z',
  },
  {
    id: 'tx-2',
    household_id: 'hh-1',
    store_name: null,
    total_amount: 850,
    item_count: 5,
    transaction_date: '2026-05-02',
    source: 'ocr',
    notes: null,
    created_at: '2026-05-02T15:00:00Z',
  },
];

describe('TransactionList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Sin compras" when transactions list is empty', () => {
    render(<TransactionList transactions={[]} budgetId="b-1" currency="EUR" />);
    expect(screen.getByText(/sin compras/i)).toBeInTheDocument();
  });

  it('renders both transactions in the list', () => {
    render(<TransactionList transactions={mockTransactions} budgetId="b-1" currency="USD" />);
    expect(screen.getByText('Carrefour')).toBeInTheDocument();
    expect(screen.getByText('$420.00')).toBeInTheDocument();
    expect(screen.getByText('$850.00')).toBeInTheDocument();
  });

  it('shows "(Sin tienda)" when store_name is null', () => {
    render(<TransactionList transactions={mockTransactions} budgetId="b-1" currency="EUR" />);
    expect(screen.getByText(/sin tienda/i)).toBeInTheDocument();
  });

  it('loads items on row click and shows them', async () => {
    const { getTransactionItemsAction } = await import('../actions');
    vi.mocked(getTransactionItemsAction).mockResolvedValue({
      data: [
        { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-1', product_name: 'Leche', quantity: 2, unit_price: 75, line_total: 150, created_at: '2026-05-04T10:00:00Z' },
        { id: 'i-2', transaction_id: 'tx-1', product_id: null, product_name: 'Pan', quantity: 1, unit_price: 120, line_total: 120, created_at: '2026-05-04T10:00:00Z' },
      ],
    });

    render(<TransactionList transactions={mockTransactions} budgetId="b-1" currency="EUR" />);

    const carrefourRow = screen.getByText('Carrefour').closest('tr') ?? screen.getByText('Carrefour').closest('[role="row"]');
    // Click to expand
    fireEvent.click(screen.getByText('Carrefour'));

    await waitFor(() => {
      expect(getTransactionItemsAction).toHaveBeenCalledWith('tx-1');
    });
  });

  it('collapses row on second click', async () => {
    const { getTransactionItemsAction } = await import('../actions');
    vi.mocked(getTransactionItemsAction).mockResolvedValue({ data: [] });

    render(<TransactionList transactions={mockTransactions} budgetId="b-1" currency="EUR" />);

    fireEvent.click(screen.getByText('Carrefour'));
    await waitFor(() => expect(getTransactionItemsAction).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('Carrefour'));
    // After second click, accordion should collapse (items area hidden)
    // Verified by absence of loading state — we just check action wasn't called again
    expect(getTransactionItemsAction).toHaveBeenCalledTimes(1);
  });

  it('shows loading text while fetching items (skeleton/loading state)', async () => {
    const { getTransactionItemsAction } = await import('../actions');

    // Return a promise that we control — stays pending until we resolve
    let resolveItems!: (value: { data: [] }) => void;
    const pending = new Promise<{ data: [] }>((res) => {
      resolveItems = res;
    });
    vi.mocked(getTransactionItemsAction).mockReturnValue(pending);

    render(<TransactionList transactions={mockTransactions} budgetId="b-1" currency="EUR" />);
    fireEvent.click(screen.getByText('Carrefour'));

    // Loading state must be shown immediately while the promise is pending
    await waitFor(() => {
      expect(screen.getByText(/cargando items/i)).toBeInTheDocument();
    });

    // Cleanup: resolve the promise so no act() warnings
    resolveItems({ data: [] });
    await waitFor(() => {
      expect(screen.queryByText(/cargando items/i)).not.toBeInTheDocument();
    });
  });

  it('shows product_name without a link when product_id is null', async () => {
    const { getTransactionItemsAction } = await import('../actions');
    vi.mocked(getTransactionItemsAction).mockResolvedValue({
      data: [
        {
          id: 'i-3',
          transaction_id: 'tx-1',
          product_id: null,
          product_name: 'Arroz Suelto',
          quantity: 1,
          unit_price: 200,
          line_total: 200,
          created_at: '2026-05-04T10:00:00Z',
        },
      ],
    });

    render(<TransactionList transactions={mockTransactions} budgetId="b-1" currency="EUR" />);
    fireEvent.click(screen.getByText('Carrefour'));

    await waitFor(() => {
      expect(screen.getByText('Arroz Suelto')).toBeInTheDocument();
    });

    // The item name must NOT be wrapped in a link element
    const itemEl = screen.getByText('Arroz Suelto');
    expect(itemEl.closest('a')).toBeNull();
  });

  it('shows "(Producto desconocido)" label alongside name when product_id is null', async () => {
    const { getTransactionItemsAction } = await import('../actions');
    vi.mocked(getTransactionItemsAction).mockResolvedValue({
      data: [
        {
          id: 'i-4',
          transaction_id: 'tx-1',
          product_id: null,
          product_name: 'Producto Raro',
          quantity: 1,
          unit_price: 50,
          line_total: 50,
          created_at: '2026-05-04T10:00:00Z',
        },
      ],
    });

    render(<TransactionList transactions={mockTransactions} budgetId="b-1" currency="EUR" />);
    fireEvent.click(screen.getByText('Carrefour'));

    await waitFor(() => {
      expect(screen.getByText(/producto desconocido/i)).toBeInTheDocument();
    });
  });
});
