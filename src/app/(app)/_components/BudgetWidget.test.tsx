import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BudgetWidget from './BudgetWidget';
import type { BudgetSummary, BudgetCurrency } from '@/lib/types';

function makeSummary(spent: number, amount: number, currency: BudgetCurrency = 'EUR', has_manual = false): BudgetSummary {
  const percentage = Math.min(100, Math.round((spent / amount) * 100));
  const manual_amount = has_manual ? spent * 0.2 : 0;
  const auto_amount = spent - manual_amount;
  return {
    budget: {
      id: 'b-1',
      household_id: 'hh-1',
      amount,
      period_type: 'monthly',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      is_active: true,
      currency,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    },
    spent,
    remaining: amount - spent,
    percentage,
    transactionCount: 1,
    currency,
    manual_amount,
    auto_amount,
    has_manual,
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

// ---------------------------------------------------------------------------
// Cambio 3 — BudgetWidget manual badge
// ---------------------------------------------------------------------------

describe('BudgetWidget — manual badge (Cambio 3)', () => {
  it('shows the manual badge when has_manual is true', () => {
    render(<BudgetWidget summary={makeSummary(100, 500, 'EUR', true)} />);
    expect(screen.getByText(/Incluye/i)).toBeInTheDocument();
  });

  it('shows "ingresado manualmente" in the badge text when has_manual is true', () => {
    render(<BudgetWidget summary={makeSummary(100, 500, 'EUR', true)} />);
    expect(screen.getByText(/ingresado manualmente/i)).toBeInTheDocument();
  });

  it('does NOT show the manual badge when has_manual is false', () => {
    render(<BudgetWidget summary={makeSummary(100, 500, 'EUR', false)} />);
    expect(screen.queryByText(/ingresado manualmente/i)).not.toBeInTheDocument();
  });
});
