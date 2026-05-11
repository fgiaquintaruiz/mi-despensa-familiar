import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BudgetClientWrapper from './BudgetClientWrapper';
import type { ShoppingTransaction } from '@/lib/types';

// ── Mock child components ───────────────────────────────────────────────────

vi.mock('./TransactionList', () => ({
  default: ({
    transactions,
    onEditTransaction,
  }: {
    transactions: ShoppingTransaction[];
    onEditTransaction?: (tx: ShoppingTransaction) => void;
  }) => (
    <div data-testid="transaction-list">
      {transactions.map((tx) => (
        <button
          key={tx.id}
          data-testid={`edit-btn-${tx.id}`}
          onClick={() => onEditTransaction?.(tx)}
        >
          Editar {tx.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./BudgetFAB', () => ({
  default: ({ onOpen }: { onOpen: () => void }) => (
    <button data-testid="fab-btn" onClick={onOpen}>
      FAB
    </button>
  ),
}));

vi.mock('./ManualTransactionModal', () => ({
  default: ({
    open,
    mode,
    transaction,
  }: {
    open: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    transaction?: ShoppingTransaction;
  }) =>
    open ? (
      <div
        role="dialog"
        aria-label="manual-transaction-modal"
        data-mode={mode}
        data-transaction-id={transaction?.id}
      />
    ) : null,
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const manualTx: ShoppingTransaction = {
  id: 'tx-manual',
  household_id: 'hh-1',
  store_name: 'Mercadona',
  total_amount: 45.5,
  item_count: 3,
  transaction_date: '2026-05-01',
  source: 'manual',
  notes: null,
  tag: 'semanal',
  created_at: '2026-05-01T10:00:00Z',
};

const ocrTx: ShoppingTransaction = {
  id: 'tx-ocr',
  household_id: 'hh-1',
  store_name: 'Carrefour',
  total_amount: 120,
  item_count: 10,
  transaction_date: '2026-05-02',
  source: 'ocr',
  notes: null,
  tag: 'mensual',
  created_at: '2026-05-02T10:00:00Z',
};

const defaultProps = {
  transactions: [manualTx, ocrTx],
  currency: 'EUR' as const,
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('BudgetClientWrapper', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders TransactionList and BudgetFAB', () => {
    render(<BudgetClientWrapper {...defaultProps} />);
    expect(screen.getByTestId('transaction-list')).toBeInTheDocument();
    expect(screen.getByTestId('fab-btn')).toBeInTheDocument();
  });

  it('modal is not visible on initial render', () => {
    render(<BudgetClientWrapper {...defaultProps} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens modal in create mode when FAB is clicked', () => {
    render(<BudgetClientWrapper {...defaultProps} />);
    fireEvent.click(screen.getByTestId('fab-btn'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('data-mode', 'create');
    expect(dialog).not.toHaveAttribute('data-transaction-id');
  });

  it('opens modal in edit mode with transaction when onEditTransaction is called', () => {
    render(<BudgetClientWrapper {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-btn-tx-manual'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('data-mode', 'edit');
    expect(dialog).toHaveAttribute('data-transaction-id', 'tx-manual');
  });

  it('does not open edit modal for non-manual (ocr) transactions', () => {
    render(<BudgetClientWrapper {...defaultProps} />);
    fireEvent.click(screen.getByTestId('edit-btn-tx-ocr'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
