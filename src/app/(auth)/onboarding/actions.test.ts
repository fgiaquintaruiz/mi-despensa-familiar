import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createHouseholdAction } from './actions';
import { createClient } from '@/lib/supabase/server';

// ---------- mock primitives ----------

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockRpc = vi.fn();

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
};

function setupSupabaseMock({
  user = { id: 'user-1' } as object | null,
  userError = null as object | null,
  membershipData = null as object | null,
  membershipError = null as object | null,
  rpcData = 'hh-new' as string | null,
  rpcError = null as object | null,
} = {}) {
  mockGetUser.mockResolvedValue({ data: { user }, error: userError });
  mockMaybeSingle.mockResolvedValue({ data: membershipData, error: membershipError });
  mockRpc.mockResolvedValue({ data: rpcData, error: rpcError });

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    rpc: mockRpc,
  } as never);
}

function makeFormData(name: string): FormData {
  const fd = new FormData();
  fd.append('name', name);
  return fd;
}

// ---------- helpers ----------

afterEach(() => {
  vi.clearAllMocks();
});

// ---------- tests ----------

describe('createHouseholdAction — validation', () => {
  it('returns error when name is empty', async () => {
    const result = await createHouseholdAction(undefined, makeFormData(''));
    expect(result).toEqual({ error: 'Ponele un nombre a tu hogar.' });
  });

  it('returns error when name is only whitespace', async () => {
    const result = await createHouseholdAction(undefined, makeFormData('   '));
    expect(result).toEqual({ error: 'Ponele un nombre a tu hogar.' });
  });

  it('returns error when name exceeds 80 characters', async () => {
    const longName = 'a'.repeat(81);
    const result = await createHouseholdAction(undefined, makeFormData(longName));
    expect(result).toEqual({
      error: 'El nombre es demasiado largo (máximo 80 caracteres).',
    });
  });

  it('does NOT call Supabase when validation fails', async () => {
    setupSupabaseMock();
    await createHouseholdAction(undefined, makeFormData(''));
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('createHouseholdAction — auth guard', () => {
  it('returns error when getUser returns no user', async () => {
    setupSupabaseMock({ user: null });
    const result = await createHouseholdAction(undefined, makeFormData('Mi Casa'));
    expect(result).toEqual({ error: 'Tenés que iniciar sesión para continuar.' });
  });

  it('returns error when getUser returns an error', async () => {
    setupSupabaseMock({ userError: { message: 'jwt expired' } });
    const result = await createHouseholdAction(undefined, makeFormData('Mi Casa'));
    expect(result).toEqual({ error: 'Tenés que iniciar sesión para continuar.' });
  });
});

describe('createHouseholdAction — existing membership', () => {
  it('redirects to / when user already has a household', async () => {
    setupSupabaseMock({ membershipData: { household_id: 'hh-existing' } });

    await expect(
      createHouseholdAction(undefined, makeFormData('Mi Casa')),
    ).rejects.toThrow('NEXT_REDIRECT:/');
  });

  it('returns error when membership check fails', async () => {
    setupSupabaseMock({ membershipError: { message: 'db error' } });

    const result = await createHouseholdAction(undefined, makeFormData('Mi Casa'));
    expect(result).toEqual({ error: 'No se pudo verificar tu hogar. Intentá de nuevo.' });
  });

  it('does NOT call rpc when membership check fails', async () => {
    setupSupabaseMock({ membershipError: { message: 'db error' } });
    await createHouseholdAction(undefined, makeFormData('Mi Casa'));
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('createHouseholdAction — RPC / happy path', () => {
  it('calls rpc create_household_with_owner with trimmed name and user id', async () => {
    setupSupabaseMock();

    await expect(
      createHouseholdAction(undefined, makeFormData('  Mi Casa  ')),
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(mockRpc).toHaveBeenCalledWith('create_household_with_owner', {
      p_name: 'Mi Casa',
      p_user_id: 'user-1',
    });
  });

  it('redirects to / after successful household creation', async () => {
    setupSupabaseMock();

    await expect(
      createHouseholdAction(undefined, makeFormData('Mi Casa')),
    ).rejects.toThrow('NEXT_REDIRECT:/');
  });

  it('returns error when rpc returns an error', async () => {
    setupSupabaseMock({ rpcError: { message: 'rpc failed' } });

    const result = await createHouseholdAction(undefined, makeFormData('Mi Casa'));
    expect(result).toEqual({ error: 'No se pudo crear el hogar. Intentá de nuevo.' });
  });

  it('returns error when rpc returns null householdId', async () => {
    setupSupabaseMock({ rpcData: null });

    const result = await createHouseholdAction(undefined, makeFormData('Mi Casa'));
    expect(result).toEqual({ error: 'No se pudo crear el hogar. Intentá de nuevo.' });
  });

  it('accepts a name exactly 80 characters long (boundary)', async () => {
    setupSupabaseMock();
    const maxName = 'a'.repeat(80);

    await expect(
      createHouseholdAction(undefined, makeFormData(maxName)),
    ).rejects.toThrow('NEXT_REDIRECT:/');
  });
});
