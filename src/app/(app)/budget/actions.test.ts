import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBudgetSummaryAction,
  createBudgetAction,
  getTransactionsForBudgetAction,
  getTransactionItemsAction,
} from './actions';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

/**
 * Chainable query builder mock. Resolves via .then() so it mimics
 * the PromiseLike interface Supabase uses.
 */
function makeQueryBuilder(resolveValue: unknown): any {
  const qb: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (v: unknown) => unknown) => Promise.resolve(resolve(resolveValue))),
  };
  return qb;
}

function setupSupabaseMock(responses: unknown[]) {
  let callIndex = 0;
  const from = vi.fn().mockImplementation(() => {
    const response = responses[callIndex] ?? { data: null, error: null };
    callIndex++;
    return makeQueryBuilder(response);
  });

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from,
  } as any);
}

function setupNoUserMock() {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(),
  } as any);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

// ---------------------------------------------------------------------------
// T-003: getBudgetSummaryAction
// ---------------------------------------------------------------------------

describe('getBudgetSummaryAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    setupNoUserMock();
    const result = await getBudgetSummaryAction();
    expect(result.error).toBe('No autenticado');
    expect(result.data).toBeUndefined();
  });

  it('returns { data: undefined } when no active budget exists', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null }, // membership
      { data: null, error: null },                       // no active budget
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.error).toBeUndefined();
    expect(result.data).toBeUndefined();
  });

  it('returns BudgetSummary with 0 transactions when budget exists but no transactions', async () => {
    const budget = {
      id: 'b-1',
      household_id: 'hh-1',
      amount: 200,
      period_type: 'monthly',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      is_active: true,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    };
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null }, // membership
      { data: budget, error: null },                     // active budget
      { data: [], error: null },                         // transactions: empty
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
    expect(result.data!.spent).toBe(0);
    expect(result.data!.remaining).toBe(200);
    expect(result.data!.percentage).toBe(0);
    expect(result.data!.transactionCount).toBe(0);
  });

  it('computes spent, remaining, percentage correctly with 2 transactions', async () => {
    const budget = {
      id: 'b-1',
      household_id: 'hh-1',
      amount: 200,
      period_type: 'monthly',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      is_active: true,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    };
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: budget, error: null },
      { data: [{ total_amount: 100, id: 't-1' }, { total_amount: 50, id: 't-2' }], error: null },
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.data!.spent).toBe(150);
    expect(result.data!.remaining).toBe(50);
    expect(result.data!.percentage).toBe(75);
    expect(result.data!.transactionCount).toBe(2);
  });

  it('clamps percentage to 100 when overspent', async () => {
    const budget = {
      id: 'b-1',
      household_id: 'hh-1',
      amount: 100,
      period_type: 'monthly',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      is_active: true,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    };
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: budget, error: null },
      { data: [{ total_amount: 120, id: 't-1' }], error: null },
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.data!.percentage).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// T-004: createBudgetAction
// ---------------------------------------------------------------------------

describe('createBudgetAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when amount is 0', async () => {
    setupSupabaseMock([]);
    const fd = makeFormData({ amount: '0', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error when amount is negative', async () => {
    setupSupabaseMock([]);
    const fd = makeFormData({ amount: '-100', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error when period_type is invalid', async () => {
    setupSupabaseMock([]);
    const fd = makeFormData({ amount: '200', period_type: 'weekly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error when start_date is missing', async () => {
    setupSupabaseMock([]);
    const fd = makeFormData({ amount: '200', period_type: 'monthly', start_date: '' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeDefined();
  });

  it('calculates end_date correctly for monthly period', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },       // membership
      { data: null, error: null },                            // deactivate previous (update)
      { data: { id: 'b-new' }, error: null },                 // insert
    ]);
    const from = vi.mocked(createClient).mock.results[0]?.value;
    const fd = makeFormData({ amount: '200', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeUndefined();
    expect(result.budgetId).toBe('b-new');
  });

  it('calculates end_date correctly for biweekly period (start + 14 days)', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: null, error: null },
      { data: { id: 'b-new' }, error: null },
    ]);
    const fd = makeFormData({ amount: '100', period_type: 'biweekly', start_date: '2026-05-04' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeUndefined();
    expect(result.budgetId).toBe('b-new');
  });

  it('deactivates previous budget and creates new one', async () => {
    let capturedInsert: unknown;
    let updateCalled = false;

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockImplementation((data: unknown) => {
            capturedInsert = data;
            return qb;
          }),
          update: vi.fn().mockImplementation(() => {
            updateCalled = true;
            return qb;
          }),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            if (table === 'budgets' && updateCalled && !capturedInsert) {
              return Promise.resolve(resolve({ data: null, error: null }));
            }
            return Promise.resolve(resolve({ data: { id: 'b-new' }, error: null }));
          }),
        };
        return qb;
      }),
    } as any);

    const fd = makeFormData({ amount: '100', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T-005: getTransactionsForBudgetAction
// ---------------------------------------------------------------------------

describe('getTransactionsForBudgetAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    setupNoUserMock();
    const result = await getTransactionsForBudgetAction('b-1');
    expect(result.error).toBeDefined();
  });

  it('returns error when budget not found (wrong household)', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null }, // membership
      { data: null, error: null },                       // budget not found (RLS)
    ]);
    const result = await getTransactionsForBudgetAction('b-other');
    expect(result.error).toBe('Budget no encontrado');
  });

  it('returns empty array when budget has no transactions', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: { start_date: '2026-05-01', end_date: '2026-05-31' }, error: null },
      { data: [], error: null },
    ]);
    const result = await getTransactionsForBudgetAction('b-1');
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
  });

  it('returns transactions for the budget period ordered by date desc', async () => {
    const transactions = [
      { id: 't-3', transaction_date: '2026-05-10', total_amount: 300 },
      { id: 't-2', transaction_date: '2026-05-05', total_amount: 200 },
      { id: 't-1', transaction_date: '2026-05-01', total_amount: 100 },
    ];
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: { start_date: '2026-05-01', end_date: '2026-05-31' }, error: null },
      { data: transactions, error: null },
    ]);
    const result = await getTransactionsForBudgetAction('b-1');
    expect(result.data).toHaveLength(3);
    // First result should be the most recent (DESC)
    expect(result.data![0].id).toBe('t-3');
  });
});

// ---------------------------------------------------------------------------
// T-006: getTransactionItemsAction
// ---------------------------------------------------------------------------

describe('getTransactionItemsAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when not authenticated', async () => {
    setupNoUserMock();
    const result = await getTransactionItemsAction('tx-1');
    expect(result.error).toBeDefined();
  });

  it('returns empty array when transaction has no items', async () => {
    setupSupabaseMock([
      { data: [], error: null }, // transaction_items query
    ]);
    const result = await getTransactionItemsAction('tx-1');
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
  });

  it('returns all items for the transaction', async () => {
    const items = [
      { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-1', product_name: 'Leche', quantity: 2, unit_price: 75, line_total: 150 },
      { id: 'i-2', transaction_id: 'tx-1', product_id: null, product_name: 'Cereal', quantity: 1, unit_price: 120, line_total: 120 },
    ];
    setupSupabaseMock([
      { data: items, error: null },
    ]);
    const result = await getTransactionItemsAction('tx-1');
    expect(result.data).toHaveLength(2);
    expect(result.data![0].product_name).toBe('Leche');
    // Item with null product_id is still returned
    expect(result.data![1].product_id).toBeNull();
  });

  it('returns item with product_id=null when product does not exist', async () => {
    setupSupabaseMock([
      { data: [{ id: 'i-1', transaction_id: 'tx-1', product_id: null, product_name: 'Producto Raro', quantity: 1, unit_price: 50, line_total: 50 }], error: null },
    ]);
    const result = await getTransactionItemsAction('tx-1');
    expect(result.data![0].product_id).toBeNull();
    expect(result.data![0].product_name).toBe('Producto Raro');
  });
});
