'use client';

import { useActionState } from 'react';
import { createManualTransactionAction } from '../actions';

const today = new Date().toISOString().split('T')[0];

export default function ManualTransactionForm() {
  const [state, action, isPending] = useActionState(createManualTransactionAction, {});

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Registrar gasto manual</h3>

      {state.error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {state.error}
        </div>
      )}

      <form action={action} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex w-28 shrink-0 flex-col gap-1">
            <label htmlFor="manual-amount" className="text-xs font-medium text-gray-600">
              Monto
            </label>
            <input
              id="manual-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
            />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="manual-description" className="text-xs font-medium text-gray-600">
              Descripción (opcional)
            </label>
            <input
              id="manual-description"
              name="description"
              type="text"
              placeholder="Ej: Farmacia"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="manual-date" className="text-xs font-medium text-gray-600">
              Fecha
            </label>
            <input
              id="manual-date"
              name="date"
              type="date"
              defaultValue={today}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPending ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
