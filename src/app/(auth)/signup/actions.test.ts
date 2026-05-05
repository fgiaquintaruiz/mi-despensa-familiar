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

import { signupAction } from './actions';
import { createClient } from '@/lib/supabase/server';
import { isEmailAllowed } from '@/lib/auth/whitelist';

const mockSignUp = vi.fn();

function setupSupabaseMock() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { signUp: mockSignUp },
  } as never);
}

function makeFormData(email: string, password: string): FormData {
  const fd = new FormData();
  fd.append('email', email);
  fd.append('password', password);
  return fd;
}

describe('signupAction — whitelist', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns error when email is not in whitelist without calling Supabase', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'allowed@test.com');
    vi.mocked(isEmailAllowed).mockReturnValue(false);
    setupSupabaseMock();

    const result = await signupAction(undefined, makeFormData('blocked@test.com', 'password123'));

    expect(result).toEqual({ error: 'Acceso no autorizado.' });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('continues to Supabase when email is in whitelist', async () => {
    vi.stubEnv('ALLOWED_EMAILS', 'allowed@test.com');
    vi.mocked(isEmailAllowed).mockReturnValue(true);
    mockSignUp.mockResolvedValue({ error: null });
    setupSupabaseMock();

    await expect(
      signupAction(undefined, makeFormData('allowed@test.com', 'password123')),
    ).rejects.toThrow('NEXT_REDIRECT:/onboarding');

    expect(mockSignUp).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// signupAction — validation errors (lines 26-29) and Supabase errors (44-47)
// ---------------------------------------------------------------------------

describe('signupAction — validation', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns email validation error when email is malformed (line 26)', async () => {
    setupSupabaseMock();
    const result = await signupAction(undefined, makeFormData('not-an-email', 'password123'));
    expect(result).toEqual({ error: 'Ingresá un email válido.' });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('returns password validation error when password is too short (line 27)', async () => {
    setupSupabaseMock();
    const result = await signupAction(undefined, makeFormData('valid@test.com', '123'));
    expect(result).toEqual({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('returns "already registered" error when Supabase returns that message (line 44)', async () => {
    // Valid input, passes whitelist, Supabase says email already registered
    vi.mocked(isEmailAllowed).mockReturnValue(true);
    mockSignUp.mockResolvedValue({ error: { message: 'User already registered' } });
    setupSupabaseMock();

    const result = await signupAction(undefined, makeFormData('existing@test.com', 'password123'));
    expect(result).toEqual({ error: 'Ya existe una cuenta con ese email.' });
  });

  it('returns generic error when Supabase fails with unknown message (line 46-47)', async () => {
    // Valid input, passes whitelist, Supabase returns generic error
    vi.mocked(isEmailAllowed).mockReturnValue(true);
    mockSignUp.mockResolvedValue({ error: { message: 'Some unexpected server error' } });
    setupSupabaseMock();

    const result = await signupAction(undefined, makeFormData('new@test.com', 'password123'));
    expect(result).toEqual({ error: 'No se pudo crear la cuenta. Intentá de nuevo.' });
  });
});
