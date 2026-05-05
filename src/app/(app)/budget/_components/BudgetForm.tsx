'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBudgetAction } from '../actions';
import type { Budget } from '@/lib/types';

interface BudgetFormProps {
  initialBudget?: Budget;
}

const today = new Date().toISOString().split('T')[0];
const firstOfMonth = today.slice(0, 7) + '-01';

export default function BudgetForm({ initialBudget }: BudgetFormProps) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createBudgetAction, {});

  useEffect(() => {
    if (state.budgetId) {
      router.push('/budget');
    }
  }, [state.budgetId, router]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="amount" className="text-sm font-semibold text-gray-700">
          Monto del presupuesto
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="1"
          required
          defaultValue={initialBudget ? String(initialBudget.amount) : ''}
          placeholder="Ej: 200000"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="currency" className="text-sm font-semibold text-gray-700">
          Moneda
        </label>
        <select
          id="currency"
          name="currency"
          required
          defaultValue={initialBudget?.currency ?? 'EUR'}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
        >
          <option value="EUR">€ Euro</option>
          <option value="USD">US$ Dólar</option>
          <option value="ARS">$ Peso argentino</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="period_type" className="text-sm font-semibold text-gray-700">
          Período
        </label>
        <select
          id="period_type"
          name="period_type"
          required
          defaultValue={initialBudget?.period_type ?? 'monthly'}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
        >
          <option value="monthly">Mensual</option>
          <option value="biweekly">Quincenal</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="start_date" className="text-sm font-semibold text-gray-700">
          ¿Cuándo cobrás?
        </label>
        <input
          id="start_date"
          name="start_date"
          type="date"
          required
          defaultValue={initialBudget?.start_date ?? firstOfMonth}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
        />
        <p className="text-xs text-gray-500">
          Tu presupuesto se reinicia automáticamente cada período a partir de esta fecha.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? 'Guardando...' : 'Guardar presupuesto'}
      </button>
    </form>
  );
}
