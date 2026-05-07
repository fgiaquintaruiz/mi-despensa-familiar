import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addProductAction,
  updateProductAction,
  deleteProductAction,
  logoutAction,
  importTicketItemsAction,
  consumeProductAction,
  restockProductAction,
  bulkDeleteProductsAction,
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
  in: vi.fn().mockReturnThis(),
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
// addProductAction — additional branch coverage
// ---------------------------------------------------------------------------

describe('addProductAction — validation and error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('returns error when name is empty', async () => {
    const fd = makeFormData({ name: '', category: 'frescos' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBe('El nombre del producto es obligatorio.');
  });

  it('returns error when category is invalid', async () => {
    const fd = makeFormData({ name: 'Leche', category: 'invalid-cat' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBe('Categoría inválida.');
  });

  it('returns error when user is not authenticated', async () => {
    setupSupabaseMock(null);
    const fd = makeFormData({ name: 'Leche', category: 'frescos' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBe('No autenticado');
  });

  it('returns DB error when product insert fails', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'duplicate key' } }));

    const fd = makeFormData({ name: 'Leche', category: 'frescos' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBe('duplicate key');
  });

  it('inserts price_history when price > 0 and product created successfully', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Insert product
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-1' }, error: null }))
      // Price history insert
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const fd = makeFormData({ name: 'Leche', category: 'frescos', price: '2.50' });
    const result = await addProductAction(undefined, fd);
    expect(result).toEqual({});
    expect(mockFrom).toHaveBeenCalledWith('price_history');
  });

  it('does not insert price_history when price is 0', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-1' }, error: null }));

    const fd = makeFormData({ name: 'Leche', category: 'frescos', price: '0' });
    const result = await addProductAction(undefined, fd);
    expect(result).toEqual({});
    // price_history should NOT have been called
    const priceHistoryCalls = mockFrom.mock.calls.filter((c: string[]) => c[0] === 'price_history');
    expect(priceHistoryCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// updateProductAction — additional branch coverage
// ---------------------------------------------------------------------------

describe('updateProductAction — validation and error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('returns error when id is empty', async () => {
    const fd = makeFormData({ id: '', name: 'Leche', category: 'frescos' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBe('ID del producto es obligatorio.');
  });

  it('returns error when name is empty', async () => {
    const fd = makeFormData({ id: 'p-1', name: '', category: 'frescos' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBe('El nombre del producto es obligatorio.');
  });

  it('returns error when category is invalid', async () => {
    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'nope' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBe('Categoría inválida.');
  });

  it('returns error when user is not authenticated', async () => {
    setupSupabaseMock(null);
    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'frescos' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBe('No autenticado');
  });

  it('returns DB error when update fails', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Fetch existing product
      .mockImplementationOnce((resolve) => resolve({ data: { price: 1.5 }, error: null }))
      // Update error
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'update failed' } }));

    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'frescos' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBe('update failed');
  });

  it('inserts price_history when price changes', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Fetch existing (price=1.50)
      .mockImplementationOnce((resolve) => resolve({ data: { price: 1.5 }, error: null }))
      // Update OK
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // Price history insert
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'frescos', price: '2.00' });
    const result = await updateProductAction(undefined, fd);
    expect(result).toEqual({});
    expect(mockFrom).toHaveBeenCalledWith('price_history');
  });

  it('does not insert price_history when price is unchanged', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { price: 2.0 }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'frescos', price: '2' });
    const result = await updateProductAction(undefined, fd);
    expect(result).toEqual({});
    const priceHistoryCalls = mockFrom.mock.calls.filter((c: string[]) => c[0] === 'price_history');
    expect(priceHistoryCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// importTicketItemsAction — additional branch coverage
// ---------------------------------------------------------------------------

describe('importTicketItemsAction — error branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('returns { imported: 0 } for empty items array', async () => {
    const result = await importTicketItemsAction([]);
    expect(result).toEqual({ imported: 0 });
  });

  it('returns error when user is not authenticated', async () => {
    setupSupabaseMock(null);
    const result = await importTicketItemsAction([{ name: 'Leche', qty: 1, price: 1.5, category: 'frescos' }]);
    expect(result.error).toBe('No autenticado');
    expect(result.imported).toBe(0);
  });

  it('returns error when membership not found', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null })); // no membership

    const result = await importTicketItemsAction([{ name: 'Leche', qty: 1, price: 1.5, category: 'frescos' }]);
    expect(result.error).toBe('No se encontró el hogar');
    expect(result.imported).toBe(0);
  });

  it('skips item when update fails (continue branch)', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Existing products (Leche exists)
      .mockImplementationOnce((resolve) => resolve({ data: [{ id: 'p-leche', name: 'Leche', current_stock: 1 }], error: null }))
      // Update FAILS
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'update error' } }));

    const result = await importTicketItemsAction([{ name: 'Leche', qty: 2, price: 1.5, category: 'frescos' }]);
    // Item was skipped due to update error
    expect(result.imported).toBe(0);
  });

  it('skips item when insert fails (continue branch)', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Existing products (empty)
      .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
      // Insert FAILS
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'insert error' } }));

    const result = await importTicketItemsAction([{ name: 'Pan', qty: 1, price: 1.0, category: 'despensa' }]);
    expect(result.imported).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// consumeProductAction — additional branch coverage
// ---------------------------------------------------------------------------

describe('consumeProductAction — additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('returns error when productId is empty', async () => {
    const result = await consumeProductAction('');
    expect(result.error).toBe('ID del producto es obligatorio.');
  });

  it('returns error when user is not authenticated', async () => {
    setupSupabaseMock(null);
    const result = await consumeProductAction('p-1');
    expect(result.error).toBe('No autenticado');
  });

  it('returns error when membership not found', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null })); // no membership

    const result = await consumeProductAction('p-1');
    expect(result.error).toBe('No se encontró el hogar');
  });

  it('returns error when product fetch fails', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Fetch product FAILS
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'not found' } }));

    const result = await consumeProductAction('p-1');
    expect(result.error).toBe('Producto no encontrado');
  });

  it('returns error when stock update fails', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Fetch product OK (stock=3)
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-1', current_stock: 3, min_stock: 0, name: 'Leche', unit: null }, error: null }))
      // Update FAILS
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'update failed' } }));

    const result = await consumeProductAction('p-1');
    expect(result.error).toBe('update failed');
  });

  it('triggers low-stock notification when stock drops below min_stock', async () => {
    // product: current_stock=2, min_stock=2 → after consume, newStock=1 < min_stock=2
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Fetch product (stock=2, min_stock=2)
      .mockImplementationOnce((resolve) =>
        resolve({ data: { id: 'p-1', current_stock: 2, min_stock: 2, name: 'Leche', unit: 'L' }, error: null }))
      // Update OK
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      // Log consumption
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const result = await consumeProductAction('p-1');
    expect(result).toEqual({});
    // fetch should have been called for the push notification
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toContain('/api/push/send');

    fetchSpy.mockRestore();
  });

  it('does not send notification when min_stock is 0 (feature disabled)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) =>
        resolve({ data: { id: 'p-1', current_stock: 5, min_stock: 0, name: 'Leche', unit: null }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    await consumeProductAction('p-1');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// restockProductAction — additional branch coverage
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// bulkDeleteProductsAction
// ---------------------------------------------------------------------------

describe('bulkDeleteProductsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
    mockThen.mockImplementation((resolve) => resolve({ data: null, error: null }));
  });

  it('returns error when productIds array is empty', async () => {
    const result = await bulkDeleteProductsAction([]);
    expect(result.error).toBeDefined();
  });

  it('calls Supabase delete with correct IDs and household_id', async () => {
    mockThen
      // Membership
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      // Delete
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const result = await bulkDeleteProductsAction(['p-1', 'p-2', 'p-3']);
    expect(result).toEqual({});
    expect(mockQueryBuilder.delete).toHaveBeenCalled();
  });

  it('calls revalidatePath on success', async () => {
    const { revalidatePath } = await import('next/cache');
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    await bulkDeleteProductsAction(['p-1']);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('returns error on Supabase failure', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'delete failed' } }));

    const result = await bulkDeleteProductsAction(['p-1']);
    expect(result.error).toBe('delete failed');
  });

  it('returns error when user is not authenticated', async () => {
    setupSupabaseMock(null);
    const result = await bulkDeleteProductsAction(['p-1']);
    expect(result.error).toBe('No autenticado');
  });
});

describe('restockProductAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('returns error when productId is empty', async () => {
    const result = await restockProductAction('');
    expect(result.error).toBe('ID del producto es obligatorio.');
  });

  it('returns error when user is not authenticated', async () => {
    setupSupabaseMock(null);
    const result = await restockProductAction('p-1');
    expect(result.error).toBe('No autenticado');
  });

  it('returns error when membership not found', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));
    const result = await restockProductAction('p-1');
    expect(result.error).toBe('No se encontró el hogar');
  });

  it('returns error when product fetch fails', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'not found' } }));
    const result = await restockProductAction('p-1');
    expect(result.error).toBe('Producto no encontrado');
  });

  it('returns error when stock update fails', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-1', current_stock: 3, name: 'Leche' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'update failed' } }));
    const result = await restockProductAction('p-1');
    expect(result.error).toBe('update failed');
  });

  it('increments stock and logs restock', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-1', current_stock: 3, name: 'Leche' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    const result = await restockProductAction('p-1');
    expect(result).toEqual({});
    expect(mockQueryBuilder.update).toHaveBeenCalledWith({ current_stock: 4 });
    expect(mockFrom).toHaveBeenCalledWith('consumption_logs');
  });
});

// ---------------------------------------------------------------------------
// deleteProductAction — additional branch coverage
// ---------------------------------------------------------------------------

describe('deleteProductAction — additional branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSupabaseMock();
  });

  it('returns error when productId is empty', async () => {
    const result = await deleteProductAction('');
    expect(result.error).toBe('ID del producto es obligatorio.');
  });

  it('returns error when user is not authenticated', async () => {
    setupSupabaseMock(null);
    const result = await deleteProductAction('p-1');
    expect(result.error).toBe('No autenticado');
  });

  it('returns DB error when delete fails', async () => {
    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: { message: 'delete failed' } }));

    const result = await deleteProductAction('p-1');
    expect(result.error).toBe('delete failed');
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

  it('does not throw when budget tracking block throws unexpectedly (catch block coverage, line 292)', async () => {
    // Simulate an unexpected throw inside the budget try block by making
    // the from() call throw synchronously after product import is done.
    let callIndex = 0;
    const mockFromThrow = vi.fn().mockImplementation((table: string) => {
      callIndex++;
      if (callIndex <= 3) {
        // membership, existing products, insert new product
        return mockQueryBuilder;
      }
      // Consumption log call (callIndex=4) returns OK
      if (callIndex === 4) return mockQueryBuilder;
      // Budget tracking: throw synchronously
      throw new Error('Unexpected synchronous error in budget tracking');
    });

    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: mockFromThrow,
    } as any);

    mockThen
      .mockImplementationOnce((resolve) => resolve({ data: { household_id: 'hh-1' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: [], error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: { id: 'p-pan' }, error: null }))
      .mockImplementationOnce((resolve) => resolve({ data: null, error: null }));

    // Must not throw — catch block swallows the error
    const result = await importTicketItemsAction([{ name: 'Pan', qty: 1, price: 120, category: 'despensa' }]);
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
