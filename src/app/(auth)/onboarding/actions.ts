'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type OnboardingState = { error: string } | undefined;

const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Ponele un nombre a tu hogar.' })
    .max(80, { error: 'El nombre es demasiado largo (máximo 80 caracteres).' }),
});

export async function createHouseholdAction(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse({
    name: formData.get('name'),
  });

  if (!parsed.success) {
    const firstError =
      parsed.error.flatten().fieldErrors.name?.[0] ?? 'Datos inválidos.';
    return { error: firstError };
  }

  const supabase = await createClient();

  // getUser() validates the JWT server-side via /auth/v1/user — secure.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'Tenés que iniciar sesión para continuar.' };
  }

  // Defense in depth: if the user already has a household, skip creation.
  // Uses the Supabase REST API for SELECT — returns empty when no membership exists,
  // which does not trigger a 403 (RLS SELECT policy on household_members simply
  // returns no rows when auth.uid() is absent or unmatched).
  const { data: existingMembership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error('[onboarding] failed to check existing membership', membershipError);
    return { error: 'No se pudo verificar tu hogar. Intentá de nuevo.' };
  }

  if (existingMembership) {
    redirect('/');
  }

  // Use a SECURITY DEFINER RPC to insert both households and household_members
  // atomically. The function bypasses RLS and runs as its owner (postgres),
  // so it works regardless of whether the client sends the user JWT or the anon
  // key to PostgREST (a known issue with @supabase/ssr in Next.js 16 server actions).
  const { data: householdId, error: rpcError } = await supabase.rpc(
    'create_household_with_owner',
    {
      p_name: parsed.data.name,
      p_user_id: user.id,
    },
  );

  if (rpcError || !householdId) {
    console.error('[onboarding] RPC create_household_with_owner failed', rpcError);
    return { error: 'No se pudo crear el hogar. Intentá de nuevo.' };
  }

  redirect('/');
}
