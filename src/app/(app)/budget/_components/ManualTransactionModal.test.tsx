import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ManualTransactionModal from './ManualTransactionModal';
import type { ShoppingTransaction } from '@/lib/types';

import * as actions from '../actions';

vi.mock('../actions', () => ({
  createManualTransactionAction: vi.fn().mockResolvedValue({}),
  updateManualTransactionAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: (action: unknown, initialState: unknown) => [initialState, action, false],
  };
});

const baseProps = {
  open: true,
  onClose: vi.fn(),
  mode: 'create' as const,
};

describe('ManualTransactionModal — Dialog visibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the dialog content when open=true', () => {
    render(<ManualTransactionModal {...baseProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does NOT render dialog content when open=false', () => {
    render(<ManualTransactionModal {...baseProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ManualTransactionModal — onClose', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ManualTransactionModal {...baseProps} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /cerrar|close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ManualTransactionModal — mode=create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows empty amount input', () => {
    render(<ManualTransactionModal {...baseProps} />);
    const amount = screen.getByLabelText(/monto/i) as HTMLInputElement;
    expect(amount.value).toBe('');
  });

  it('defaults tag to "diaria"', () => {
    render(<ManualTransactionModal {...baseProps} />);
    const hidden = document.querySelector('input[name="tag"]') as HTMLInputElement;
    expect(hidden).not.toBeNull();
    expect(hidden.value).toBe('diaria');
  });

  it('shows "Registrar gasto manual" as dialog title', () => {
    render(<ManualTransactionModal {...baseProps} />);
    expect(screen.getByText(/registrar gasto manual/i)).toBeInTheDocument();
  });
});

describe('ManualTransactionModal — Escape key', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls onClose when Escape key is pressed while modal is open', () => {
    const onClose = vi.fn();
    render(<ManualTransactionModal {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ManualTransactionModal — mode=edit', () => {
  beforeEach(() => vi.clearAllMocks());

  const transaction: ShoppingTransaction = {
    id: 'tx-1',
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

  it('pre-fills amount from transaction', () => {
    render(
      <ManualTransactionModal {...baseProps} mode="edit" transaction={transaction} />,
    );
    const amount = screen.getByLabelText(/monto/i) as HTMLInputElement;
    expect(amount.value).toBe('45.5');
  });

  it('pre-fills description from store_name', () => {
    render(
      <ManualTransactionModal {...baseProps} mode="edit" transaction={transaction} />,
    );
    const description = screen.getByLabelText(/descripción/i) as HTMLInputElement;
    expect(description.value).toBe('Mercadona');
  });

  it('pre-selects the tag from transaction', () => {
    render(
      <ManualTransactionModal {...baseProps} mode="edit" transaction={transaction} />,
    );
    const hidden = document.querySelector('input[name="tag"]') as HTMLInputElement;
    expect(hidden.value).toBe('semanal');
  });

  it('pre-fills date from transaction', () => {
    render(
      <ManualTransactionModal {...baseProps} mode="edit" transaction={transaction} />,
    );
    const dateInput = document.querySelector('input[name="date"]') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-05-01');
  });

  it('calls updateManualTransactionAction on submit in edit mode', async () => {
    const updateSpy = vi.spyOn(actions, 'updateManualTransactionAction');
    render(
      <ManualTransactionModal {...baseProps} mode="edit" transaction={transaction} />,
    );
    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    expect(updateSpy).toHaveBeenCalledWith('tx-1', expect.objectContaining({
      store: 'Mercadona',
      date: '2026-05-01',
      total: 45.5,
      tag: 'semanal',
    }));
  });

  it('shows "Editar gasto manual" as dialog title in edit mode', () => {
    render(
      <ManualTransactionModal {...baseProps} mode="edit" transaction={transaction} />,
    );
    expect(screen.getByText(/editar gasto manual/i)).toBeInTheDocument();
  });
});
