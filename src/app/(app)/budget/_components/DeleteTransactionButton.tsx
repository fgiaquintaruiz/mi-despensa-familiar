'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { formatAmount } from '@/lib/currency';
import type { BudgetCurrency } from '@/lib/types';
import { softDeleteTransactionAction } from '../actions';

interface Props {
  transactionId: string;
  storeName: string | null;
  totalAmount: number;
  currency: BudgetCurrency;
}

export default function DeleteTransactionButton({
  transactionId,
  storeName,
  totalAmount,
  currency,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [removeStock, setRemoveStock] = useState(false);
  const [, startTransition] = useTransition();

  function handleOpen() {
    setError(null);
    setRemoveStock(false);
    setOpen(true);
  }

  async function handleConfirm() {
    setIsPending(true);
    try {
      const result = await softDeleteTransactionAction(transactionId, removeStock);
      if (result.error) {
        setError(result.error);
        // Stale row: server says the transaction is gone — refresh the RSC
        // tree so the user sees the updated list even though the dialog
        // stays open with the friendly message.
        if (result.code === 'transaction_gone') {
          startTransition(() => {
            router.refresh();
          });
        }
        return;
      }
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsPending(false);
    }
  }

  const subtitle = `${storeName ?? '(Sin tienda)'} — ${formatAmount(totalAmount, currency)}`;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-11 w-11 items-center justify-center text-red-500 hover:text-red-600"
        aria-label="Eliminar gasto"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="mb-1 text-base font-semibold">¿Eliminar este gasto?</p>
            <p className="mb-4 text-sm text-gray-500">{subtitle}</p>

            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={removeStock}
                onChange={(e) => setRemoveStock(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              También quitar los productos del stock
            </label>

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-300 py-3 font-medium text-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-3 font-medium text-white disabled:opacity-60"
              >
                {isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
