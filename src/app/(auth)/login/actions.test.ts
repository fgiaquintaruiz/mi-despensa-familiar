import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth/whitelist', () => ({
  isEmailAllowed: vi.fn(),
}));

import { loginAction } from './actions';
import { createClient } from '@/lib/supabase/server';
import { isEmailAllowed } from '@/lib/auth/whitelist';

const mockSignInWithPassword = vi.fn();

function setupSupabaseMock() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword: mockSignInWithPassword },
  } as never);
}

function makeFormData(email: string, password: string): FormData {
  const fd = new FormData();
  fd.append('email', email);
  fd.append('password', password);
  return fd;
}

describe('loginAction — whitelist', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns error when email is not in whitelist without calling Supabase', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'allowed@test.com');
    vi.mocked(isEmailAllowed).mockReturnValue(false);
    setupSupabaseMock();

    const result = await loginAction(undefined, makeFormData('blocked@test.com', 'password123'));

    expect(result).toEqual({ error: 'Acceso no autorizado.' });
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it('continues to Supabase when email is in whitelist', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'allowed@test.com');
    vi.mocked(isEmailAllowed).mockReturnValue(true);
    mockSignInWithPassword.mockResolvedValue({ error: null });
    setupSupabaseMock();

    await expect(
      loginAction(undefined, makeFormData('allowed@test.com', 'password123')),
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding');

    expect(mockSignInWithPassword).toHaveBeenCalledOnce();
  });
});
