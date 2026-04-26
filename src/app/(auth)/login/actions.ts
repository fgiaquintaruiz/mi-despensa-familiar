'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type LoginState = { error: string } | undefined;

const loginSchema = z.object({
  email: z.email({ error: 'Ingresá un email válido.' }),
  password: z.string().min(6, { error: 'La contraseña debe tener al menos 6 caracteres.' }),
});

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    const firstError =
      parsed.error.flatten().fieldErrors.email?.[0] ??
      parsed.error.flatten().fieldErrors.password?.[0] ??
      'Datos inválidos.';
    return { error: firstError };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: 'Email o contraseña incorrectos.' };
  }

  // Onboarding page redirects to '/' if user already has a household.
  redirect('/onboarding');
}
