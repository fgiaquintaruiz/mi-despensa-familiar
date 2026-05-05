import Link from 'next/link';
import type { BudgetSummary } from '@/lib/types';

interface BudgetWidgetProps {
  summary: BudgetSummary | null;
}

function getBarColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('es-AR').format(Math.round(amount));
}

export default function BudgetWidget({ summary }: BudgetWidgetProps) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-[var(--color-brand)]/20 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-700">Configurá tu presupuesto mensual</p>
        <p className="mt-1 text-xs text-gray-500">Empezá a trackear tus gastos de supermercado</p>
        <Link
          href="/budget/settings"
          className="mt-3 inline-block rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Crear presupuesto
        </Link>
      </div>
    );
  }

  const { spent, budget, percentage, remaining } = summary;
  const clampedPercentage = Math.min(100, percentage);
  const barColor = getBarColor(clampedPercentage);

  const monthName = new Date(budget.start_date + 'T12:00:00').toLocaleString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-xl border border-[var(--color-brand)]/20 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 capitalize">
          Presupuesto {monthName}
        </h3>
        <span className="text-xs font-medium text-gray-500">{clampedPercentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          data-testid="budget-bar"
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${clampedPercentage}%` }}
          aria-valuenow={clampedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
          aria-label={`${clampedPercentage}% del presupuesto gastado`}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          <p className="font-medium text-gray-800">
            Gastaste ${formatAmount(spent)} de ${formatAmount(Number(budget.amount))}
          </p>
          <p className="text-xs text-gray-500">Te quedan ${formatAmount(remaining)}</p>
        </div>
        <Link
          href="/budget"
          className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
        >
          Ver detalle
        </Link>
      </div>
    </div>
  );
}
