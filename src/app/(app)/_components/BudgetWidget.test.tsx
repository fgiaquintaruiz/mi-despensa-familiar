import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetWidget from './BudgetWidget';
import type { BudgetSummary } from '@/lib/types';

function makeSummary(spent: number, amount: number): BudgetSummary {
  const percentage = Math.min(100, Math.round((spent / amount) * 100));
  return {
    budget: {
      id: 'b-1',
      household_id: 'hh-1',
      amount,
      period_type: 'monthly',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      is_active: true,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    },
    spent,
    remaining: amount - spent,
    percentage,
    transactionCount: 1,
  };
}

describe('BudgetWidget', () => {
  it('shows CTA heading "Configurá tu presupuesto mensual" when summary is null', () => {
    render(<BudgetWidget summary={null} />);
    expect(screen.getByText(/configurá tu presupuesto mensual/i)).toBeInTheDocument();
  });

  it('shows subtext "Empezá a trackear" when summary is null', () => {
    render(<BudgetWidget summary={null} />);
    expect(screen.getByText(/empezá a trackear/i)).toBeInTheDocument();
  });

  it('CTA "Crear presupuesto" links to /budget/settings when summary is null', () => {
    render(<BudgetWidget summary={null} />);
    const link = screen.getByRole('link', { name: /crear presupuesto/i });
    expect(link).toHaveAttribute('href', '/budget/settings');
  });

  it('shows spent and total amounts when summary is provided', () => {
    render(<BudgetWidget summary={makeSummary(100, 200)} />);
    // "Gastaste $100 de $200" — both amounts appear in one paragraph
    expect(screen.getByText(/Gastaste/i)).toBeInTheDocument();
    expect(screen.getAllByText(/100/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it('applies green color class when percentage < 70', () => {
    const { container } = render(<BudgetWidget summary={makeSummary(50, 200)} />);
    const bar = container.querySelector('[data-testid="budget-bar"]');
    expect(bar?.className).toContain('bg-green-500');
  });

  it('applies yellow color class when percentage is 70-90', () => {
    const { container } = render(<BudgetWidget summary={makeSummary(75, 100)} />);
    const bar = container.querySelector('[data-testid="budget-bar"]');
    expect(bar?.className).toContain('bg-yellow-500');
  });

  it('applies red color class when percentage >= 90', () => {
    const { container } = render(<BudgetWidget summary={makeSummary(95, 100)} />);
    const bar = container.querySelector('[data-testid="budget-bar"]');
    expect(bar?.className).toContain('bg-red-500');
  });

  it('shows percentage text clamped to 100 even when overspent', () => {
    render(<BudgetWidget summary={makeSummary(150, 100)} />);
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('shows "Ver detalle" link to /budget when summary is provided', () => {
    render(<BudgetWidget summary={makeSummary(50, 200)} />);
    const link = screen.getByRole('link', { name: /ver detalle/i });
    expect(link).toHaveAttribute('href', '/budget');
  });
});
