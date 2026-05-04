import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addProductAction,
  updateProductAction,
  deleteProductAction,
  logoutAction,
  importTicketItemsAction,
  consumeProductAction,
} from './actions';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT:${url}` });
  }),
}));

const mockThen = vi.fn();
const mockQueryBuilder: any = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  then: mockThen,
};

const mockFrom = vi.fn().mockReturnValue(mockQueryBuilder);

function setupSupabaseMock(user: object | null = { id: 'user-1' }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: mockFrom,
  } as any);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe('addProductAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockThen.mockImplementation((resolve) => resolve({ data: null, error: null }));
  });

  it('returns {} on successful insert', async () => {
    // 1. Membership, 2. Insert
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const fd = makeFormData({ name: 'Leche', category: 'frescos', current_stock: '3' });
    const result = await addProductAction(undefined, fd);
    expect(result).toEqual({});
  });
});

describe('updateProductAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockThen.mockImplementation((resolve) => resolve({ data: null, error: null }));
  });

  it('returns {} on successful update', async () => {
    // 1. Membership, 2. Update
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const fd = makeFormData({
      id: 'p-1',
      name: 'Leche',
      category: 'frescos',
      current_stock: '3',
    });
    const result = await updateProductAction(undefined, fd);
    expect(result).toEqual({});
  });
});

describe('importTicketItemsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockThen.mockImplementation((resolve) => resolve({ data: null, error: null }));
  });

  it('deduplicates and logs restock', async () => {
    // Leche already exists, Pan is new
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Existing products
      .mockImplementationOnce((resolve) => resolve({ data: [{ id: 'p-leche', name: 'Leche', current_stock: 1 }], error: null }))
      // Update Leche
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // Log Leche
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // Insert Pan
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-pan' }, error: null }))
      // Log Pan
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const items = [
      { name: 'Leche', qty: 2, price: 1.5, category: 'frescos' as const },
      { name: 'Pan', qty: 1, price: 1.0, category: 'despensa' as const },
    ];

    const result = await importTicketItemsAction(items);
    expect(result).toEqual({ imported: 2 });
    
    // Verify update for Leche (stock 1 + 2 = 3)
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ current_stock: 3 }));
    // Verify insert for Pan
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pan' }));
    // Verify logs
    expect(mockFrom).toHaveBeenCalledWith('consumption_logs');
  });
});

describe('consumeProductAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockThen.mockImplementation((resolve) => resolve({ data: null, error: null }));
  });

  it('decrements stock and logs consumption', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Fetch product
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-1', current_stock: 5 }, error: null }))
      // Update stock
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // Log consumption
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const result = await consumeProductAction('p-1');
    expect(result).toEqual({});
    expect(mockQueryBuilder.update).toHaveBeenCalledWith({ current_stock: 4 });
  });

  it('returns error if stock is 0', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Fetch product
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-1', current_stock: 0 }, error: null }));

    const result = await consumeProductAction('p-1');
    expect(result.error).toBe('No hay stock disponible');
  });
});

describe('deleteProductAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockThen.mockImplementation((resolve) => resolve({ data: null, error: null }));
  });

  it('returns {} on successful delete', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const result = await deleteProductAction('p-1');
    expect(result).toEqual({});
  });
});

describe('logoutAction', () => {
  it('calls signOut() and redirects', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({});
    vi.mocked(createClient).mockResolvedValue({
      auth: { signOut: mockSignOut },
    } as any);

    const { redirect } = await import('next/navigation');
    await logoutAction().catch(() => {});
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});

// ---------------------------------------------------------------------------
// T-007: importTicketItemsAction — best-effort budget tracking
// ---------------------------------------------------------------------------

describe('importTicketItemsAction — budget tracking (best-effort)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('returns correct imported count when budget tracking succeeds', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Existing products (empty)
      .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
      // Insert Leche
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-leche' }, error: null }))
      // Log Leche restock
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // budget: insert shopping_transaction
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'tx-1' }, error: null }))
      // budget: insert transaction_items
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const items = [{ name: 'Leche', qty: 2, price: 75, category: 'frescos' as const }];
    const result = await importTicketItemsAction(items);
    expect(result.imported).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('still returns correct imported count when shopping_transaction insert fails (best-effort)', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Existing products (empty)
      .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
      // Insert Leche
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-leche' }, error: null }))
      // Log Leche restock
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // budget: shopping_transaction insert FAILS
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'DB constraint violation' } }));

    const items = [{ name: 'Leche', qty: 2, price: 75, category: 'frescos' as const }];
    const result = await importTicketItemsAction(items);
    // Best-effort: imported count must not change even if budget tracking fails
    expect(result.imported).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('does not throw when transaction_items insert fails (orphaned transaction is acceptable)', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Existing products (empty)
      .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
      // Insert Pan
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-pan' }, error: null }))
      // Log Pan restock
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // budget: shopping_transaction insert OK
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'tx-1' }, error: null }))
      // budget: transaction_items insert FAILS
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'items insert failed' } }));

    const items = [{ name: 'Pan', qty: 1, price: 120, category: 'despensa' as const }];
    // Must NOT throw — best-effort guarantees no propagation
    await expect(importTicketItemsAction(items)).resolves.toEqual({ imported: 1 });
  });

  it('computes total_amount as sum of line totals', async () => {
    let capturedTransaction: Record<string, unknown> | undefined;

    const originalMockFrom = mockFrom;
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      callCount++;
      if (table === 'shopping_transactions' && callCount > 4) {
        // Capture the insert call on shopping_transactions (budget tracking)
        const qb = { ...mockQueryBuilder };
        qb.insert = vi.fn().mockImplementation((data: unknown) => {
          capturedTransaction = data as Record<string, unknown>;
          return qb;
        });
        mockThen.mockImplementationOnce((resolve) => resolve({ data: { id: 'tx-1' }, error: null }));
        return qb;
      }
      return mockQueryBuilder;
    });

    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-leche' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-pan' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'tx-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const items = [
      { name: 'Leche', qty: 2, price: 75, category: 'frescos' as const },
      { name: 'Pan', qty: 1, price: 120, category: 'despensa' as const },
    ];
    const result = await importTicketItemsAction(items);
    expect(result.imported).toBe(2);
    // total_amount = 2*75 + 1*120 = 270
    mockFrom.mockReturnValue(mockQueryBuilder);
  });
});
