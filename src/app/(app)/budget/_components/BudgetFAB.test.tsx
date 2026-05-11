import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BudgetFAB from './BudgetFAB';

describe('BudgetFAB', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the FAB button', () => {
    render(<BudgetFAB onOpen={vi.fn()} />);
    expect(screen.getByRole('button', { name: /agregar gasto/i })).toBeInTheDocument();
  });

  it('calls onOpen when FAB is clicked', () => {
    const onOpen = vi.fn();
    render(<BudgetFAB onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /agregar gasto/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not render a modal by itself', () => {
    render(<BudgetFAB onOpen={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
