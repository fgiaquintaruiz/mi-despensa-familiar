import type { Metadata } from 'next';
import Link from 'next/link';
import { getBudgetSummaryAction } from '../actions';
import BudgetForm from '../_components/BudgetForm';

export const metadata: Metadata = {
  title: 'Configurar presupuesto | Mi Despensa',
};

export default async function BudgetSettingsPage() {
  const { data: summary } = await getBudgetSummaryAction();
  const activeBudget = summary?.budget;

  return (
    <main className="pb-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link href="/budget" className="hover:underline">
            Presupuesto
          </Link>
          <span>/</span>
          <span>Configurar</span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-800">
          {activeBudget ? 'Editar presupuesto' : 'Crear presupuesto'}
        </h2>
        <p className="text-sm text-gray-500">
          {activeBudget
            ? 'Actualizá el monto o período de tu presupuesto activo.'
            : 'Configurá tu presupuesto mensual para seguir tus gastos de supermercado.'}
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <BudgetForm initialBudget={activeBudget} />
      </div>
    </main>
  );
}
