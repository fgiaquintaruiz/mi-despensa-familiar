'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signupAction, type SignupState } from './actions';

const initialState: SignupState = undefined;

export default function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <div className="rounded-[var(--radius-card)] bg-white p-8 shadow-[var(--shadow-card)]">
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-foreground)]">
        Crear cuenta
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Registrate para gestionar tu despensa familiar.
      </p>

      <form action={formAction} noValidate>
        <div className="mb-4">
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby={state?.error ? 'form-error' : undefined}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
            placeholder="vos@ejemplo.com"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby={state?.error ? 'form-error' : undefined}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        {state?.error && (
          <p
            id="form-error"
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-lg border border-[var(--color-warn-border)] bg-red-50 px-4 py-2 text-sm text-[var(--color-warn-text)]"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[var(--radius-button)] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Ya tenés cuenta?{' '}
        <Link
          href="/login"
          className="font-medium text-[var(--color-brand)] hover:underline"
        >
          Ingresá
        </Link>
      </p>
    </div>
  );
}
