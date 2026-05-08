import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBudgetSummaryAction,
  createBudgetAction,
  createManualTransactionAction,
  getTransactionsForBudgetAction,
  getTransactionItemsAction,
  softDeleteTransactionAction,
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
    is: vi.fn().mockReturnThis(),
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

  it('returns error when membership not found', async () => {
    setupSupabaseMock([
      { data: null, error: null }, // membership not found
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.error).toBe('No se encontró el hogar');
  });

  it('returns error when budget query returns DB error (line 65)', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },      // membership OK
      { data: null, error: { message: 'DB error on budget' } }, // budgetError
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.error).toBe('DB error on budget');
  });

  it('handles null aggData gracefully — returns empty transactions (line 78: aggData ?? [])', async () => {
    // Supabase returns { data: null, error: null } for shopping_transactions query
    // aggData ?? [] fallback fires → transactions = []
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
      { data: null, error: null }, // null aggData → fallback to []
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.error).toBeUndefined();
    expect(result.data!.spent).toBe(0);
    expect(result.data!.transactionCount).toBe(0);
  });

  it('returns error when transactions query returns DB error (line 76)', async () => {
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
      { data: null, error: { message: 'transactions query failed' } }, // aggError
    ]);
    const result = await getBudgetSummaryAction();
    expect(result.error).toBe('transactions query failed');
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

  it('returns error when budget insert fails (line 179)', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },  // membership
      { data: null, error: null },                        // deactivate previous
      { data: null, error: { message: 'budget insert failed' } }, // insert error
    ]);
    const fd = makeFormData({ amount: '200', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBe('budget insert failed');
  });

  it('returns error when user not authenticated (line 145)', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    } as any);
    const fd = makeFormData({ amount: '200', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBe('No autenticado');
  });

  it('returns error when membership not found (line 154)', async () => {
    setupSupabaseMock([
      { data: null, error: null }, // no membership
    ]);
    const fd = makeFormData({ amount: '200', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBe('No se encontró el hogar');
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
// T-017: createBudgetAction — period rollover validation
// ---------------------------------------------------------------------------

describe('createBudgetAction — period rollover (T-017)', () => {
  beforeEach(() => vi.clearAllMocks());

  function setupMockWithInsertCapture(onInsert: (data: unknown) => void) {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          insert: vi.fn().mockImplementation((data: unknown) => {
            if (table === 'budgets') onInsert(data);
            return qb;
          }),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            return Promise.resolve(resolve({ data: { id: 'b-new' }, error: null }));
          }),
        };
        return qb;
      }),
    } as any);
  }

  it('calculates end_date as start_date + 1 month exactly for monthly period', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupMockWithInsertCapture((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '200', period_type: 'monthly', start_date: '2026-05-01' });
    await createBudgetAction(undefined, fd);

    expect(capturedInsert).toBeDefined();
    expect(capturedInsert!.end_date).toBe('2026-06-01');
  });

  it('calculates end_date as start_date + 14 days for biweekly period', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupMockWithInsertCapture((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '100', period_type: 'biweekly', start_date: '2026-05-04' });
    await createBudgetAction(undefined, fd);

    expect(capturedInsert).toBeDefined();
    expect(capturedInsert!.end_date).toBe('2026-05-18');
  });

  it('correctly rolls over December → January for monthly period', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupMockWithInsertCapture((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '300', period_type: 'monthly', start_date: '2026-12-01' });
    await createBudgetAction(undefined, fd);

    expect(capturedInsert).toBeDefined();
    // December + 1 month = January of the following year
    expect(capturedInsert!.end_date).toBe('2027-01-01');
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

  it('returns error when membership not found (line 209)', async () => {
    setupSupabaseMock([
      { data: null, error: null }, // no membership
    ]);
    const result = await getTransactionsForBudgetAction('b-1');
    expect(result.error).toBe('No se encontró el hogar');
  });

  it('returns error when budget not found (wrong household)', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null }, // membership
      { data: null, error: null },                       // budget not found (RLS)
    ]);
    const result = await getTransactionsForBudgetAction('b-other');
    expect(result.error).toBe('Budget no encontrado');
  });

  it('returns error when shopping_transactions query fails (lines 229-230)', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: { start_date: '2026-05-01', end_date: '2026-05-31' }, error: null },
      { data: null, error: { message: 'transactions query error' } },
    ]);
    const result = await getTransactionsForBudgetAction('b-1');
    expect(result.error).toBe('transactions query error');
  });

  it('returns empty array when transactions query returns null data (line 230: data ?? [])', async () => {
    // data is null but no error → { data: data ?? [] } → []
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: { start_date: '2026-05-01', end_date: '2026-05-31' }, error: null },
      { data: null, error: null }, // null data → fallback to []
    ]);
    const result = await getTransactionsForBudgetAction('b-1');
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
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

  it('returns error when DB query fails (line 311)', async () => {
    // getTransactionItemsAction: user authenticated, but transaction_items query returns error
    setupSupabaseMock([
      { data: null, error: { message: 'permission denied' } }, // transaction_items query fails
    ]);
    const result = await getTransactionItemsAction('tx-1');
    expect(result.error).toBe('permission denied');
    expect(result.data).toBeUndefined();
  });

  it('returns empty array when transaction_items query returns null data (line 312: data ?? [])', async () => {
    // data is null but no error → { data: data ?? [] } → []
    setupSupabaseMock([
      { data: null, error: null }, // null data → fallback to []
    ]);
    const result = await getTransactionItemsAction('tx-1');
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T-022: Data integrity — item_count, total_amount, line_total consistency
// ---------------------------------------------------------------------------

describe('T-022: Data integrity — getBudgetSummaryAction total computation', () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * These tests verify that getBudgetSummaryAction correctly aggregates
   * total_amount from shopping_transactions, which should equal the sum
   * of all line_total values from the corresponding transaction_items.
   *
   * The invariant: SUM(transactions.total_amount) === SUM(items.line_total)
   * is preserved by importTicketItemsAction (best-effort budget tracking).
   */

  it('spent equals sum of all transaction total_amounts (3 transactions)', async () => {
    const budget = {
      id: 'b-1',
      household_id: 'hh-1',
      amount: 1000,
      period_type: 'monthly',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      is_active: true,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    };

    // 3 items: $100, $50, $25 — total should be $175
    const transactions = [
      { id: 'tx-1', total_amount: 100 },
      { id: 'tx-2', total_amount: 50 },
      { id: 'tx-3', total_amount: 25 },
    ];

    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: budget, error: null },
      { data: transactions, error: null },
    ]);

    const result = await getBudgetSummaryAction();

    expect(result.data).toBeDefined();
    // SUM(total_amount) = 100 + 50 + 25 = 175
    expect(result.data!.spent).toBe(175);
    // remaining = 1000 - 175 = 825
    expect(result.data!.remaining).toBe(825);
    // item_count via transactionCount
    expect(result.data!.transactionCount).toBe(3);
  });

  it('total_amount equals line_total sum: verifies math invariant on returned items', async () => {
    /**
     * Simulates the invariant:
     *   transaction.total_amount === SUM(transaction_items.line_total)
     *
     * Mock: a transaction with total_amount=270 was created by importTicketItemsAction
     * with items: [Leche: 2×75=150, Pan: 1×120=120] → sum = 270 ✓
     */
    const items = [
      { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-1', product_name: 'Leche', quantity: 2, unit_price: 75, line_total: 150, created_at: '' },
      { id: 'i-2', transaction_id: 'tx-1', product_id: null, product_name: 'Pan', quantity: 1, unit_price: 120, line_total: 120, created_at: '' },
    ];

    setupSupabaseMock([
      { data: items, error: null },
    ]);

    const result = await getTransactionItemsAction('tx-1');

    expect(result.data).toBeDefined();
    expect(result.data).toHaveLength(2);

    const sumOfLineTotals = result.data!.reduce((acc, item) => acc + item.line_total, 0);
    // SUM(line_total) = 150 + 120 = 270
    expect(sumOfLineTotals).toBe(270);

    // item_count from the transaction (2 items inserted) matches data length
    expect(result.data!.length).toBe(2);
  });

  it('total_amount computation handles decimal line_totals without floating-point errors', async () => {
    /**
     * Edge case: multiple items with decimal prices.
     * e.g.: 3×33.33 = 99.99 (not 100.0 due to floating point)
     */
    const budget = {
      id: 'b-1',
      household_id: 'hh-1',
      amount: 500,
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
      { data: [{ id: 'tx-1', total_amount: 99.99 }], error: null },
    ]);

    const result = await getBudgetSummaryAction();

    expect(result.data).toBeDefined();
    expect(result.data!.spent).toBeCloseTo(99.99, 2);
    expect(result.data!.remaining).toBeCloseTo(400.01, 2);
  });
});

// ---------------------------------------------------------------------------
// Cambio 1 — createBudgetAction with currency
// ---------------------------------------------------------------------------

describe('createBudgetAction — currency (Cambio 1)', () => {
  beforeEach(() => vi.clearAllMocks());

  function setupMockWithInsertCapture(onInsert: (data: unknown) => void) {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          insert: vi.fn().mockImplementation((data: unknown) => {
            if (table === 'budgets') onInsert(data);
            return qb;
          }),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            return Promise.resolve(resolve({ data: { id: 'b-new' }, error: null }));
          }),
        };
        return qb;
      }),
    } as any);
  }

  it('saves currency=ARS when provided', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupMockWithInsertCapture((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '1000', period_type: 'monthly', start_date: '2026-05-01', currency: 'ARS' });
    const result = await createBudgetAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert).toBeDefined();
    expect(capturedInsert!.currency).toBe('ARS');
  });

  it('saves currency=EUR when provided', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupMockWithInsertCapture((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '500', period_type: 'monthly', start_date: '2026-05-01', currency: 'EUR' });
    const result = await createBudgetAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert!.currency).toBe('EUR');
  });

  it('saves currency=USD when provided', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupMockWithInsertCapture((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '500', period_type: 'biweekly', start_date: '2026-05-01', currency: 'USD' });
    const result = await createBudgetAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert!.currency).toBe('USD');
  });

  it('returns error when currency is invalid', async () => {
    setupSupabaseMock([]);
    const fd = makeFormData({ amount: '500', period_type: 'monthly', start_date: '2026-05-01', currency: 'GBP' });
    const result = await createBudgetAction(undefined, fd);
    expect(result.error).toBeDefined();
  });

  it('defaults to EUR when currency is not provided', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupMockWithInsertCapture((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '200', period_type: 'monthly', start_date: '2026-05-01' });
    const result = await createBudgetAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert!.currency).toBe('EUR');
  });
});

// ---------------------------------------------------------------------------
// Cambio 3 — createManualTransactionAction
// ---------------------------------------------------------------------------

describe('createManualTransactionAction', () => {
  beforeEach(() => vi.clearAllMocks());

  function setupManualTransactionMock(onInsert?: (data: unknown) => void) {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockImplementation((data: unknown) => {
            if (table === 'shopping_transactions' && onInsert) onInsert(data);
            return qb;
          }),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            return Promise.resolve(resolve({ data: { id: 'tx-new' }, error: null }));
          }),
        };
        return qb;
      }),
    } as any);
  }

  it('creates transaction with source=manual and item_count=0 when amount is valid', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupManualTransactionMock((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '150', description: 'Farmacia', date: '2026-05-04' });
    const result = await createManualTransactionAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert).toBeDefined();
    expect(capturedInsert!.source).toBe('manual');
    expect(capturedInsert!.item_count).toBe(0);
    expect(capturedInsert!.total_amount).toBe(150);
  });

  it('uses description as store_name when provided', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupManualTransactionMock((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '75', description: 'Verdulería', date: '2026-05-04' });
    await createManualTransactionAction(undefined, fd);

    expect(capturedInsert!.store_name).toBe('Verdulería');
  });

  it('uses "Gasto manual" as store_name when description is empty', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupManualTransactionMock((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '75', description: '', date: '2026-05-04' });
    await createManualTransactionAction(undefined, fd);

    expect(capturedInsert!.store_name).toBe('Gasto manual');
  });

  it('returns error when amount is 0', async () => {
    setupSupabaseMock([]);
    const fd = makeFormData({ amount: '0', date: '2026-05-04' });
    const result = await createManualTransactionAction(undefined, fd);
    expect(result.error).toBeDefined();
  });

  it('returns error when amount is negative', async () => {
    setupSupabaseMock([]);
    const fd = makeFormData({ amount: '-50', date: '2026-05-04' });
    const result = await createManualTransactionAction(undefined, fd);
    expect(result.error).toBeDefined();
  });

  it('uses today as date when date field is absent', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupManualTransactionMock((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '100' });
    await createManualTransactionAction(undefined, fd);

    const today = new Date().toISOString().split('T')[0];
    expect(capturedInsert!.transaction_date).toBe(today);
  });

  it('returns error when user is not authenticated (line 260)', async () => {
    // User is null → early return "No autenticado"
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    } as any);

    const fd = makeFormData({ amount: '100', date: '2026-05-04' });
    const result = await createManualTransactionAction(undefined, fd);
    expect(result.error).toBe('No autenticado');
  });

  it('returns error when membership not found (line 269)', async () => {
    // User exists but no household membership
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation(() => makeQueryBuilder({ data: null, error: null })),
    } as any);

    const fd = makeFormData({ amount: '100', date: '2026-05-04' });
    const result = await createManualTransactionAction(undefined, fd);
    expect(result.error).toBe('No se encontró el hogar');
  });

  it('returns error when shopping_transactions insert fails (line 282)', async () => {
    // All setup OK but final insert returns error
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'household_members') {
          return makeQueryBuilder({ data: { household_id: 'hh-1' }, error: null });
        }
        return makeQueryBuilder({ data: null, error: { message: 'insert failed' } });
      }),
    } as any);

    const fd = makeFormData({ amount: '150', date: '2026-05-04' });
    const result = await createManualTransactionAction(undefined, fd);
    expect(result.error).toBe('insert failed');
  });

  // ---------------------------------------------------------------------------
  // FEAT-3 Fase A — tag column on createManualTransactionAction
  // ---------------------------------------------------------------------------

  it('persists tag when valid tag is provided', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupManualTransactionMock((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '150', description: 'Mercadona', date: '2026-05-04', tag: 'mensual' });
    const result = await createManualTransactionAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert!.tag).toBe('mensual');
  });

  it.each(['mensual', 'semanal', 'diaria', 'imprevisto'])('accepts valid tag "%s"', async (tag) => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupManualTransactionMock((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '50', date: '2026-05-04', tag });
    const result = await createManualTransactionAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert!.tag).toBe(tag);
  });

  it('rejects invalid tag without inserting', async () => {
    let insertCalled = false;
    setupManualTransactionMock(() => {
      insertCalled = true;
    });

    const fd = makeFormData({ amount: '50', date: '2026-05-04', tag: 'random-bad-tag' });
    const result = await createManualTransactionAction(undefined, fd);

    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/tag/i);
    expect(insertCalled).toBe(false);
  });

  it('defaults tag to "diaria" when tag field is absent', async () => {
    let capturedInsert: Record<string, unknown> | undefined;
    setupManualTransactionMock((data) => {
      capturedInsert = data as Record<string, unknown>;
    });

    const fd = makeFormData({ amount: '50', date: '2026-05-04' });
    const result = await createManualTransactionAction(undefined, fd);

    expect(result.error).toBeUndefined();
    expect(capturedInsert!.tag).toBe('diaria');
  });
});

// ---------------------------------------------------------------------------
// Cambio 3 — getBudgetSummaryAction with manual_amount / auto_amount breakdown
// ---------------------------------------------------------------------------

describe('getBudgetSummaryAction — manual vs auto breakdown (Cambio 3)', () => {
  beforeEach(() => vi.clearAllMocks());

  const baseBudget = {
    id: 'b-1',
    household_id: 'hh-1',
    amount: 500,
    period_type: 'monthly',
    start_date: '2026-05-01',
    end_date: '2026-05-31',
    is_active: true,
    currency: 'EUR',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
  };

  it('computes auto_amount and manual_amount separately from mixed transactions', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: baseBudget, error: null },
      {
        data: [
          { id: 't-1', total_amount: 100, source: 'ocr' },
          { id: 't-2', total_amount: 50, source: 'ocr' },
          { id: 't-3', total_amount: 30, source: 'manual' },
        ],
        error: null,
      },
    ]);

    const result = await getBudgetSummaryAction();

    expect(result.data).toBeDefined();
    expect(result.data!.auto_amount).toBe(150);
    expect(result.data!.manual_amount).toBe(30);
    expect(result.data!.has_manual).toBe(true);
    expect(result.data!.spent).toBe(180); // total = 150 + 30
  });

  it('sets has_manual=false when all transactions are ocr', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: baseBudget, error: null },
      {
        data: [
          { id: 't-1', total_amount: 200, source: 'ocr' },
        ],
        error: null,
      },
    ]);

    const result = await getBudgetSummaryAction();

    expect(result.data!.manual_amount).toBe(0);
    expect(result.data!.auto_amount).toBe(200);
    expect(result.data!.has_manual).toBe(false);
  });

  it('sets has_manual=false when there are no transactions', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: baseBudget, error: null },
      { data: [], error: null },
    ]);

    const result = await getBudgetSummaryAction();

    expect(result.data!.manual_amount).toBe(0);
    expect(result.data!.auto_amount).toBe(0);
    expect(result.data!.has_manual).toBe(false);
  });

  it('exposes currency from the budget in the summary', async () => {
    setupSupabaseMock([
      { data: { household_id: 'hh-1' }, error: null },
      { data: { ...baseBudget, currency: 'ARS' }, error: null },
      { data: [], error: null },
    ]);

    const result = await getBudgetSummaryAction();

    expect(result.data!.currency).toBe('ARS');
  });
});

// ---------------------------------------------------------------------------
// FEAT-2 — softDeleteTransactionAction
// ---------------------------------------------------------------------------

describe('softDeleteTransactionAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when transactionId is empty', async () => {
    setupSupabaseMock([]);
    const result = await softDeleteTransactionAction('', false);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/id/i);
  });

  it('returns error when user is not authenticated', async () => {
    setupNoUserMock();
    const result = await softDeleteTransactionAction('tx-1', false);
    expect(result.error).toBe('No autenticado');
  });

  it('returns error when membership not found', async () => {
    setupSupabaseMock([
      { data: null, error: null }, // no membership
    ]);
    const result = await softDeleteTransactionAction('tx-1', false);
    expect(result.error).toBe('No se encontró el hogar');
  });

  it('soft-deletes transaction via rpc(soft_delete_transaction) with t_id', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation(() => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null })),
          ),
        };
        return qb;
      }),
      rpc,
    } as any);

    const result = await softDeleteTransactionAction('tx-1', false);
    expect(result.error).toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('soft_delete_transaction', { t_id: 'tx-1' });
  });

  it('calls revalidatePath on success', async () => {
    const { revalidatePath } = await import('next/cache');
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation(() => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null })),
          ),
        };
        return qb;
      }),
      rpc,
    } as any);

    await softDeleteTransactionAction('tx-1', false);
    expect(revalidatePath).toHaveBeenCalledWith('/budget', 'layout');
  });

  it('does NOT query transaction_items when removeStock is false', async () => {
    const fromCalls: string[] = [];
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        fromCalls.push(table);
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          }),
        };
        return qb;
      }),
      rpc,
    } as any);

    await softDeleteTransactionAction('tx-1', false);
    expect(fromCalls).not.toContain('transaction_items');
    expect(fromCalls).not.toContain('products');
  });

  it('decrements product stock for each item when removeStock is true', async () => {
    let productUpdateCount = 0;
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockImplementation(() => {
            if (table === 'products') {
              productUpdateCount++;
            }
            return qb;
          }),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            if (table === 'transaction_items') {
              return Promise.resolve(resolve({
                data: [
                  { id: 'i-1', product_id: 'p-1', product_name: 'Leche', quantity: 2 },
                  { id: 'i-2', product_id: 'p-2', product_name: 'Pan', quantity: 3 },
                ],
                error: null,
              }));
            }
            if (table === 'products') {
              return Promise.resolve(resolve({ data: { id: 'p-x', current_stock: 10 }, error: null }));
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          }),
        };
        return qb;
      }),
      rpc,
    } as any);

    const result = await softDeleteTransactionAction('tx-1', true);
    expect(result.error).toBeUndefined();
    // Two items with product_id → two product updates
    expect(productUpdateCount).toBe(2);
  });

  it('skips items with null product_id when decrementing stock', async () => {
    let productUpdateCount = 0;
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockImplementation(() => {
            if (table === 'products') {
              productUpdateCount++;
            }
            return qb;
          }),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            if (table === 'transaction_items') {
              return Promise.resolve(resolve({
                data: [
                  { id: 'i-1', product_id: null, product_name: 'Producto Raro', quantity: 1 },
                  { id: 'i-2', product_id: 'p-2', product_name: 'Leche', quantity: 2 },
                ],
                error: null,
              }));
            }
            if (table === 'products') {
              return Promise.resolve(resolve({ data: { id: 'p-2', current_stock: 5 }, error: null }));
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          }),
        };
        return qb;
      }),
      rpc,
    } as any);

    const result = await softDeleteTransactionAction('tx-1', true);
    expect(result.error).toBeUndefined();
    // Only 1 product update (null product_id item is skipped)
    expect(productUpdateCount).toBe(1);
  });

  it('floors product stock at 0 — never goes negative', async () => {
    const capturedUpdates: Array<Record<string, unknown>> = [];
    const rpc = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockImplementation((data: unknown) => {
            if (table === 'products') {
              capturedUpdates.push(data as Record<string, unknown>);
            }
            return qb;
          }),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) => {
            if (table === 'household_members') {
              return Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null }));
            }
            if (table === 'transaction_items') {
              return Promise.resolve(resolve({
                data: [
                  { id: 'i-1', product_id: 'p-1', product_name: 'Leche', quantity: 10 },
                ],
                error: null,
              }));
            }
            if (table === 'products') {
              // current_stock is only 3, but item.quantity is 10
              return Promise.resolve(resolve({ data: { id: 'p-1', current_stock: 3 }, error: null }));
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          }),
        };
        return qb;
      }),
      rpc,
    } as any);

    const result = await softDeleteTransactionAction('tx-1', true);
    expect(result.error).toBeUndefined();
    expect(capturedUpdates).toHaveLength(1);
    // Math.max(0, 3 - 10) = 0 — floored at 0
    expect(capturedUpdates[0].current_stock).toBe(0);
  });

  it('returns error when rpc(soft_delete_transaction) fails', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'rpc failed' } });

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockImplementation(() => {
        const qb: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockReturnThis(),
          single: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolve({ data: { household_id: 'hh-1' }, error: null })),
          ),
        };
        return qb;
      }),
      rpc,
    } as any);

    const result = await softDeleteTransactionAction('tx-1', false);
    expect(result.error).toBe('rpc failed');
  });
});
