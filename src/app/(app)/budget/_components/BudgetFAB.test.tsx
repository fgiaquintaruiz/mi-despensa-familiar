import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BudgetFAB from './BudgetFAB';

vi.mock('./ManualTransactionModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="manual-transaction-modal">
        <button onClick={onClose}>Cerrar</button>
      </div>
    ) : null,
}));

describe('BudgetFAB', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the FAB button', () => {
    render(<BudgetFAB />);
    expect(screen.getByRole('button', { name: /agregar gasto/i })).toBeInTheDocument();
  });

  it('modal is not visible on initial render', () => {
    render(<BudgetFAB />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicking the FAB opens the modal', () => {
    render(<BudgetFAB />);
    const fab = screen.getByRole('button', { name: /agregar gasto/i });
    fireEvent.click(fab);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calling onClose from modal closes it', () => {
    render(<BudgetFAB />);
    const fab = screen.getByRole('button', { name: /agregar gasto/i });
    fireEvent.click(fab);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
