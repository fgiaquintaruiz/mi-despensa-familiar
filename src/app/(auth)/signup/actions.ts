'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export type SignupState = { error: string } | undefined;

const signupSchema = z.object({
  email: z.email({ error: 'Ingresá un email válido.' }),
  password: z.string().min(6, { error: 'La contraseña debe tener al menos 6 caracteres.' }),
});

export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
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
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Handle common Supabase signup errors with user-friendly messages
    if (error.message.includes('already registered')) {
      return { error: 'Ya existe una cuenta con ese email.' };
    }
    return { error: 'No se pudo crear la cuenta. Intentá de nuevo.' };
  }

  // Email confirmation is OFF — session is established immediately on signUp
  redirect('/');
}
