'use client';

import { useActionState } from 'react';
import { createHouseholdAction, type OnboardingState } from './actions';

const initialState: OnboardingState = undefined;

export default function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    createHouseholdAction,
    initialState,
  );

  return (
    <div className="rounded-[var(--radius-card)] bg-white p-8 shadow-[var(--shadow-card)]">
      <h1 className="mb-2 text-2xl font-bold text-[var(--color-foreground)]">
        Creá tu hogar
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Ponele un nombre para empezar a gestionar tu despensa.
      </p>

      <form action={formAction} noValidate>
        <div className="mb-6">
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-[var(--color-foreground)]"
          >
            Nombre del hogar
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="off"
            maxLength={80}
            required
            aria-describedby={state?.error ? 'form-error' : undefined}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/20"
            placeholder="Casa familia García"
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
          {pending ? 'Creando hogar…' : 'Crear hogar'}
        </button>
      </form>
    </div>
  );
}
