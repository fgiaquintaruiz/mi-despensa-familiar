import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppLayout from './layout';
import { createClient } from '@/lib/supabase/server';

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server');

const mockMaybeSingle = vi.fn();

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
};

const mockFrom = vi.fn().mockReturnValue(mockQueryBuilder);

function buildSupabaseMock(user: object | null, membershipData: object | null) {
  mockMaybeSingle.mockResolvedValue({ data: membershipData });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: mockFrom,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

describe('AppLayout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /login when there is no authenticated user', async () => {
    buildSupabaseMock(null, null);

    await expect(AppLayout({ children: <div /> })).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding when user has no household membership', async () => {
    buildSupabaseMock({ id: 'user-1' }, null);

    await expect(AppLayout({ children: <div /> })).rejects.toThrow('NEXT_REDIRECT:/onboarding');
  });

  it('renders children when user has an active household membership', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' });

    const result = await AppLayout({ children: <span data-testid="child" /> });

    expect(result).toBeTruthy();
  });
});
