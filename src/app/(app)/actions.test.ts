import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addProductAction, updateProductAction, deleteProductAction, logoutAction, importTicketItemsAction } from './actions';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT:${url}` });
  }),
}));

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockMembershipEq = vi.fn();
const mockProductEq = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

let _productResult: { error: object | null } = { error: null };

const mockQueryBuilderProducts = {
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: mockProductEq,
  then(
    resolve: (value: { error: object | null }) => void,
    reject: (reason: unknown) => void,
  ) {
    return Promise.resolve(_productResult).then(resolve, reject);
  },
};

const mockQueryBuilderSelect = {
  select: mockSelect,
  eq: mockMembershipEq,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
};

mockSelect.mockReturnValue(mockQueryBuilderSelect);
mockMembershipEq.mockReturnValue(mockQueryBuilderSelect);
mockLimit.mockReturnValue(mockQueryBuilderSelect);
mockUpdate.mockReturnValue(mockQueryBuilderProducts);
mockDelete.mockReturnValue(mockQueryBuilderProducts);
mockProductEq.mockReturnValue(mockQueryBuilderProducts);

const mockFrom = vi.fn();

function buildSupabaseMock(
  user: object | null,
  membershipData: object | null,
  productResult: { error: object | null } = { error: null },
) {
  _productResult = productResult;
  mockMaybeSingle.mockResolvedValue({ data: membershipData });
  mockInsert.mockResolvedValue(productResult);
  mockFrom.mockImplementation((table: string) => {
    if (table === 'household_members') return mockQueryBuilderSelect;
    if (table === 'products') return mockQueryBuilderProducts;
    return mockQueryBuilderSelect;
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe('addProductAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when name is empty — does not call Supabase', async () => {
    const fd = makeFormData({ name: '', category: 'despensa' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when name is only whitespace — does not call Supabase', async () => {
    const fd = makeFormData({ name: '   ', category: 'despensa' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when category is invalid — does not call Supabase', async () => {
    const fd = makeFormData({ name: 'Leche', category: 'invalid-cat' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when category is missing — does not call Supabase', async () => {
    const fd = makeFormData({ name: 'Leche' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns "No autenticado" when there is no authenticated user', async () => {
    buildSupabaseMock(null, null);
    const fd = makeFormData({ name: 'Leche', category: 'frescos' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBe('No autenticado');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns {} on successful insert', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' });
    const fd = makeFormData({ name: 'Leche', category: 'frescos', current_stock: '3' });
    const result = await addProductAction(undefined, fd);
    expect(result).toEqual({});
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: 'hh-1',
        name: 'Leche',
        category: 'frescos',
        current_stock: 3,
      }),
    );
  });

  it('defaults current_stock to 1 when not provided', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' });
    const fd = makeFormData({ name: 'Arroz', category: 'despensa' });
    const result = await addProductAction(undefined, fd);
    expect(result).toEqual({});
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ current_stock: 1 }),
    );
  });

  it('returns error message when insert fails', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' }, { error: { message: 'DB error' } });
    const fd = makeFormData({ name: 'Leche', category: 'frescos' });
    const result = await addProductAction(undefined, fd);
    expect(result.error).toBe('DB error');
  });
});

describe('updateProductAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when id is empty — does not call Supabase', async () => {
    const fd = makeFormData({ id: '', name: 'Leche', category: 'frescos' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when name is empty — does not call Supabase', async () => {
    const fd = makeFormData({ id: 'p-1', name: '', category: 'frescos' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when category is invalid — does not call Supabase', async () => {
    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'invalid-cat' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when there is no authenticated user', async () => {
    buildSupabaseMock(null, null);
    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'frescos' });
    const result = await updateProductAction(undefined, fd);
    expect(result.error).toBe('No autenticado');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns {} on successful update', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' });
    const fd = makeFormData({ id: 'p-1', name: 'Leche', category: 'frescos', current_stock: '3', min_stock: '1', brand: 'La Serenísima', unit: 'l', price: '150' });
    const result = await updateProductAction(undefined, fd);
    expect(result).toEqual({});
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Leche', category: 'frescos' }),
    );
  });
});

describe('deleteProductAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns error when productId is empty — does not call Supabase', async () => {
    const result = await deleteProductAction('');
    expect(result.error).toBeDefined();
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when there is no authenticated user', async () => {
    buildSupabaseMock(null, null);
    const result = await deleteProductAction('p-1');
    expect(result.error).toBe('No autenticado');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns {} on successful delete', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' });
    const result = await deleteProductAction('p-1');
    expect(result).toEqual({});
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('importTicketItemsAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns { imported: 0 } without calling Supabase when items array is empty', async () => {
    const result = await importTicketItemsAction([]);
    expect(result).toEqual({ imported: 0 });
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });

  it('returns error when there is no authenticated user', async () => {
    buildSupabaseMock(null, null);
    const result = await importTicketItemsAction([
      { name: 'LECHE', qty: 1, price: 1.0, category: 'frescos' },
    ]);
    expect(result.error).toBeDefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns { imported: N } on successful insert', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' });
    const items = [
      { name: 'LECHE', qty: 2, price: 1.1, category: 'frescos' as const },
      { name: 'PAN', qty: 1, price: 0.9, category: 'despensa' as const },
    ];
    const result = await importTicketItemsAction(items);
    expect(result).toEqual({ imported: 2 });
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});

describe('logoutAction', () => {
  const mockSignOut = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signOut: mockSignOut },
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('calls signOut()', async () => {
    await logoutAction().catch(() => {});
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('redirects to /login after signOut', async () => {
    const { redirect } = await import('next/navigation');
    await logoutAction().catch(() => {});
    expect(redirect).toHaveBeenCalledWith('/login');
  });
});
