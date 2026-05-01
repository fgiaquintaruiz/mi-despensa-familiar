import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingPage from './page';
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

describe('OnboardingPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects to /login when there is no authenticated user', async () => {
    buildSupabaseMock(null, null);

    await expect(OnboardingPage()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('redirects to / if user already has a household membership', async () => {
    buildSupabaseMock({ id: 'user-1' }, { household_id: 'hh-1' });

    await expect(OnboardingPage()).rejects.toThrow('NEXT_REDIRECT:/');
    expect(mockFrom).toHaveBeenCalledWith('household_members');
  });

  it('renders OnboardingForm if user has no household membership', async () => {
    buildSupabaseMock({ id: 'user-1' }, null);

    const result = await OnboardingPage();
    expect(result).toBeTruthy();
    // It returns <OnboardingForm /> which is a React element
    expect(result.type.name).toBe('OnboardingForm');
  });
});
