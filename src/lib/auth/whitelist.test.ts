import { describe, it, expect, afterEach, vi } from 'vitest';
import { isEmailAllowed } from './whitelist';

describe('isEmailAllowed', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when email is in the whitelist', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'allowed@test.com,other@test.com');
    expect(isEmailAllowed('allowed@test.com')).toBe(true);
  });

  it('returns false when email is NOT in the whitelist', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'allowed@test.com,other@test.com');
    expect(isEmailAllowed('notallowed@test.com')).toBe(false);
  });

  it('returns true when env var is not defined (permissive dev mode)', () => {
    vi.stubEnv('ALLOWED_EMAILS', '');
    expect(isEmailAllowed('anyone@test.com')).toBe(true);
  });

  it('returns true when env var is empty string', () => {
    vi.stubEnv('ALLOWED_EMAILS', '');
    expect(isEmailAllowed('anyone@test.com')).toBe(true);
  });

  it('is case-insensitive: A@B.COM matches a@b.com', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'a@b.com');
    expect(isEmailAllowed('A@B.COM')).toBe(true);
  });

  it('handles extra spaces in the env var without breaking the match', () => {
    vi.stubEnv('ALLOWED_EMAILS', '  allowed@test.com  ,  other@test.com  ');
    expect(isEmailAllowed('allowed@test.com')).toBe(true);
  });
});
