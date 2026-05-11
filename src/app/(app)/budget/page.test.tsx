import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import BudgetPage from './page';
import { getBudgetSummaryAction } from './actions';
import type { BudgetSummary, ShoppingTransaction } from '@/lib/types';

vi.mock('./actions', () => ({
  getBudgetSummaryAction: vi.fn(),
}));

// Server components inside the page (BudgetWidget, BudgetClientWrapper)
// are stubbed out — we only care about the per-tag stat cards on this page.
vi.mock('../_components/BudgetWidget', () => ({
  default: () => <div data-testid="budget-widget" />,
}));
vi.mock('./_components/BudgetClientWrapper', () => ({
  default: () => <div data-testid="budget-client-wrapper" />,
}));

function tx(partial: Partial<ShoppingTransaction>): ShoppingTransaction {
  return {
    id: 'tx',
    household_id: 'hh-1',
    store_name: null,
    total_amount: 0,
    item_count: 1,
    transaction_date: '2026-05-04',
    source: 'manual',
    notes: null,
    tag: null,
    created_at: '2026-05-04T00:00:00Z',
    ...partial,
  };
}

function summary(transactions: ShoppingTransaction[]): BudgetSummary {
  return {
    budget: {
      id: 'b-1',
      household_id: 'hh-1',
      amount: 1000,
      period_type: 'monthly',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      is_active: true,
      currency: 'EUR',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    },
    spent: transactions.reduce((acc, t) => acc + Number(t.total_amount), 0),
    remaining: 0,
    percentage: 0,
    transactionCount: transactions.length,
    currency: 'EUR',
    manual_amount: 0,
    auto_amount: 0,
    has_manual: false,
    transactions,
  };
}

async function renderPage() {
  const ui = await BudgetPage();
  return render(ui);
}

describe('BudgetPage — per-tag stat cards (FEAT-3 Fase A)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders one card per tag when transactions are tagged', async () => {
    const transactions = [
      tx({ id: '1', total_amount: 300, tag: 'mensual' }),
      tx({ id: '2', total_amount: 100, tag: 'semanal' }),
      tx({ id: '3', total_amount: 50, tag: 'semanal' }),
      tx({ id: '4', total_amount: 15, tag: 'diaria' }),
    ];
    vi.mocked(getBudgetSummaryAction).mockResolvedValue({ data: summary(transactions) });

    await renderPage();

    expect(screen.getByText(/mensual/i)).toBeInTheDocument();
    expect(screen.getByText(/semanal/i)).toBeInTheDocument();
    expect(screen.getByText(/diaria/i)).toBeInTheDocument();
    expect(screen.queryByText(/imprevisto/i)).not.toBeInTheDocument();
    // Aggregated "Ticket promedio" must NOT be shown when per-tag breakdown is available.
    expect(screen.queryByText(/ticket promedio/i)).not.toBeInTheDocument();
  });

  it('shows the aggregated "Ticket promedio" card when there are NO transactions', async () => {
    vi.mocked(getBudgetSummaryAction).mockResolvedValue({ data: summary([]) });

    await renderPage();

    expect(screen.getByText(/ticket promedio/i)).toBeInTheDocument();
  });

  it('shows the aggregated card when transactions exist but none has a tag', async () => {
    const transactions = [
      tx({ id: '1', total_amount: 100, tag: null }),
      tx({ id: '2', total_amount: 50, tag: null }),
    ];
    vi.mocked(getBudgetSummaryAction).mockResolvedValue({ data: summary(transactions) });

    await renderPage();

    expect(screen.getByText(/ticket promedio/i)).toBeInTheDocument();
    expect(screen.queryByText(/^mensual$/i)).not.toBeInTheDocument();
  });

  it('displays tag average with decimal precision (no Math.round)', async () => {
    // 198.85 must NOT be rounded to 199
    const transactions = [
      tx({ id: '1', total_amount: 198.85, tag: 'mensual' }),
    ];
    vi.mocked(getBudgetSummaryAction).mockResolvedValue({ data: summary(transactions) });

    const { container } = await renderPage();

    // formatAmount(198.85, 'EUR') → "198,85 €" (es-ES locale)
    // If Math.round were still present we'd see "199" — failing the test.
    expect(container.textContent).toMatch(/198[,.]85/);
    expect(container.textContent).not.toMatch(/\b199[,.]00\b/);
  });

  it('displays max transaction amount with decimal precision (no Math.round)', async () => {
    const transactions = [
      tx({ id: '1', total_amount: 198.85, tag: null }),
    ];
    vi.mocked(getBudgetSummaryAction).mockResolvedValue({ data: summary(transactions) });

    const { container } = await renderPage();

    expect(container.textContent).toMatch(/198[,.]85/);
  });

  it('renders count in "N tickets" format under each tag', async () => {
    const transactions = [
      tx({ id: '1', total_amount: 100, tag: 'semanal' }),
      tx({ id: '2', total_amount: 50, tag: 'semanal' }),
    ];
    vi.mocked(getBudgetSummaryAction).mockResolvedValue({ data: summary(transactions) });

    const { container } = await renderPage();

    // The card should mention "2 tickets" somewhere.
    expect(container.textContent).toMatch(/2\s*tickets/i);
  });
});
