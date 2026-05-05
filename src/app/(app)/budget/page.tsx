import type { Metadata } from 'next';
import Link from 'next/link';
import { getBudgetSummaryAction } from './actions';
import BudgetWidget from '../_components/BudgetWidget';
import TransactionList from './_components/TransactionList';
import ManualTransactionForm from './_components/ManualTransactionForm';
import { formatAmount } from '@/lib/currency';

export const metadata: Metadata = {
  title: 'Presupuesto | Mi Despensa',
};

export default async function BudgetPage() {
  const { data: summary } = await getBudgetSummaryAction();

  if (!summary) {
    return (
      <main className="pb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-gray-800">Presupuesto</h2>
          <p className="text-sm text-gray-500">Seguí tus gastos de supermercado</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <p className="mb-4 text-gray-500">No tenés ningún presupuesto activo.</p>
          <Link
            href="/budget/settings"
            className="inline-block rounded-lg bg-[var(--color-brand)] px-6 py-2 text-sm font-semibold text-white"
          >
            Crear presupuesto
          </Link>
        </div>
      </main>
    );
  }

  const transactions = summary.transactions;

  const avgTicket =
    transactions.length > 0
      ? transactions.reduce((acc, t) => acc + Number(t.total_amount), 0) / transactions.length
      : 0;

  const maxTransaction = transactions.reduce(
    (max, t) => (Number(t.total_amount) > Number(max?.total_amount ?? 0) ? t : max),
    transactions[0],
  );

  const totalItems = transactions.reduce((acc, t) => acc + t.item_count, 0);

  return (
    <main className="pb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800">Presupuesto</h2>
          <p className="text-sm text-gray-500">Período activo</p>
        </div>
        <Link
          href="/budget/settings"
          className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand)]"
        >
          Editar presupuesto
        </Link>
      </div>

      {/* Budget Summary Widget */}
      <div className="mb-4">
        <BudgetWidget summary={summary} />
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-gray-800">{transactions.length}</p>
          <p className="text-xs text-gray-500">Compras</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-gray-800">
            {formatAmount(Math.round(avgTicket), summary.currency)}
          </p>
          <p className="text-xs text-gray-500">Ticket promedio</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-gray-800">
            {formatAmount(Math.round(Number(maxTransaction?.total_amount ?? 0)), summary.currency)}
          </p>
          <p className="text-xs text-gray-500">Compra más cara</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
          <p className="text-lg font-bold text-gray-800">{totalItems}</p>
          <p className="text-xs text-gray-500">Items totales</p>
        </div>
      </div>

      {/* Manual transaction form */}
      <div className="mb-4">
        <ManualTransactionForm />
      </div>

      {/* Transaction List */}
      <TransactionList transactions={transactions} budgetId={summary.budget.id} />
    </main>
  );
}
