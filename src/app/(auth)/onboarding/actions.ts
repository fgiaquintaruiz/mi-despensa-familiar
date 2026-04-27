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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    return { error: 'Tenés que iniciar sesión para continuar.' };
  }

  // Defense in depth: short-circuit if the user already belongs to a household.
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

  // Step 1: create the household. RLS policy households_insert_authenticated allows this.
  const { data: insertedHousehold, error: insertHouseholdError } = await supabase
    .from('households')
    .insert({ name: parsed.data.name })
    .select('id')
    .single();

  if (insertHouseholdError || !insertedHousehold) {
    console.error('[onboarding] failed to create household', insertHouseholdError);
    return { error: 'No se pudo crear el hogar. Intentá de nuevo.' };
  }

  // Step 2: insert the owner membership. The bootstrap RLS policy
  // (household_members_insert_owner_or_bootstrap) allows this because the household
  // currently has no members.
  const { error: insertMemberError } = await supabase.from('household_members').insert({
    household_id: insertedHousehold.id,
    user_id: user.id,
    role: 'owner',
  });

  if (insertMemberError) {
    console.error(
      '[onboarding] failed to create owner membership; rolling back household',
      insertMemberError,
    );
    // Best-effort cleanup: without an owner the household is unreachable via RLS
    // (households_select_member requires membership) so leaving it would be garbage.
    const { error: cleanupError } = await supabase
      .from('households')
      .delete()
      .eq('id', insertedHousehold.id);
    if (cleanupError) {
      console.error('[onboarding] failed to clean up orphan household', cleanupError);
    }
    return { error: 'No se pudo completar la configuración. Intentá de nuevo.' };
  }

  redirect('/');
}
