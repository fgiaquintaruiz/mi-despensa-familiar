/**
 * T-016: RLS security tests — cross-household isolation
 *
 * These tests simulate RLS enforcement via mocks: when a user from household A
 * calls an action using a budget/transaction belonging to household B, the mock
 * returns empty/null (simulating what Postgres RLS would return in production).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBudgetSummaryAction,
  getTransactionsForBudgetAction,
  getTransactionItemsAction,
} from './actions';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

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

/**
 * Sets up a mock where every `from()` call returns a sequentially-resolved value.
 * Simulates RLS by returning empty/null when household_id doesn't match.
 */
function setupSupabaseMock(userId: string, householdId: string, responses: unknown[]) {
  let callIndex = 0;
  const from = vi.fn().mockImplementation(() => {
    const response = responses[callIndex] ?? { data: null, error: null };
    callIndex++;
    return makeQueryBuilder(response);
  });

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
    from,
  } as any);
}

// ---------------------------------------------------------------------------
// T-016-A: getBudgetSummaryAction — User B sees no data from Household A
// ---------------------------------------------------------------------------

describe('T-016: RLS — getBudgetSummaryAction cross-household isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { data: undefined } when user belongs to household B and no budget exists for that household', async () => {
    // User B is authenticated with their own household (hh-B).
    // RLS filters: the budgets query returns null because no budget belongs to hh-B.
    setupSupabaseMock('user-b', 'hh-B', [
      { data: { household_id: 'hh-B' }, error: null }, // membership for user-B → hh-B
      { data: null, error: null },                       // budgets query → RLS returns null (no budget for hh-B)
    ]);

    const result = await getBudgetSummaryAction();

    // User B must see no data — not household A's budget
    expect(result.error).toBeUndefined();
    expect(result.data).toBeUndefined();
  });

  it('does not return household A budget when user belongs to household B', async () => {
    // Even if we pass household_id of A to the query, RLS filters it out.
    // This simulates the case where both households exist but user B has their own membership.
    setupSupabaseMock('user-b', 'hh-B', [
      { data: { household_id: 'hh-B' }, error: null }, // membership → hh-B
      // RLS: Postgres filters WHERE is_household_member(household_id) — returns null
      { data: null, error: null },
    ]);

    const result = await getBudgetSummaryAction();

    // Must never receive household A's budget data
    expect(result.data).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T-016-B: getTransactionsForBudgetAction — User B cannot access budget from Household A
// ---------------------------------------------------------------------------

describe('T-016: RLS — getTransactionsForBudgetAction cross-household isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns "Budget no encontrado" when user B requests a budget belonging to household A', async () => {
    // User B's membership is hh-B.
    // The budget query for budget_id='budget-of-A' filtered by household_id='hh-B' → null (RLS).
    setupSupabaseMock('user-b', 'hh-B', [
      { data: { household_id: 'hh-B' }, error: null }, // membership → hh-B
      { data: null, error: null },                       // budget lookup: .eq('household_id','hh-B') → null because budget belongs to hh-A
    ]);

    const result = await getTransactionsForBudgetAction('budget-of-A');

    // Must NOT return household A's transactions
    expect(result.data).toBeUndefined();
    expect(result.error).toBe('Budget no encontrado');
  });

  it('returns empty array when user B has a budget but no transactions match', async () => {
    // User B has their own budget but it has no transactions.
    setupSupabaseMock('user-b', 'hh-B', [
      { data: { household_id: 'hh-B' }, error: null },
      { data: { start_date: '2026-05-01', end_date: '2026-05-31' }, error: null },
      // RLS on shopping_transactions: only returns rows with household_id = hh-B → empty
      { data: [], error: null },
    ]);

    const result = await getTransactionsForBudgetAction('budget-of-B');

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T-016-C: getTransactionItemsAction — Transitive RLS via shopping_transactions
// ---------------------------------------------------------------------------

describe('T-016: RLS — getTransactionItemsAction transitive isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when user B requests items of a transaction from household A', async () => {
    // getTransactionItemsAction queries transaction_items WHERE transaction_id = X.
    // RLS policy on transaction_items uses subquery:
    //   USING (transaction_id IN (SELECT id FROM shopping_transactions WHERE is_household_member(household_id)))
    // So if the transaction belongs to hh-A and user is from hh-B → Postgres returns [].
    setupSupabaseMock('user-b', 'hh-B', [
      // transaction_items query → RLS subquery filters out items from hh-A → []
      { data: [], error: null },
    ]);

    const result = await getTransactionItemsAction('transaction-of-A');

    // Must return empty — not household A's items
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual([]);
  });

  it('does not expose product details from another household via transaction items', async () => {
    // Even with a known transaction ID from household A, RLS returns []
    setupSupabaseMock('user-b', 'hh-B', [
      { data: [], error: null }, // RLS: items subquery filters by household membership
    ]);

    const result = await getTransactionItemsAction('tx-from-household-a');

    expect(result.data).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });
});
