'use client';

import { useActionState, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createManualTransactionAction, updateManualTransactionAction } from '../actions';
import {
  SHOPPING_TRANSACTION_TAGS,
  type ShoppingTransaction,
  type ShoppingTransactionTag,
} from '@/lib/types';

const TAG_LABELS: Record<ShoppingTransactionTag, string> = {
  mensual: 'Mensual',
  semanal: 'Semanal',
  diaria: 'Diaria',
  imprevisto: 'Imprevisto',
};

const DEFAULT_TAG: ShoppingTransactionTag = 'diaria';
const today = new Date().toISOString().split('T')[0];

export interface ManualTransactionModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  transaction?: ShoppingTransaction;
}

export default function ManualTransactionModal({
  open,
  onClose,
  mode,
  transaction,
}: ManualTransactionModalProps) {
  const initialTag: ShoppingTransactionTag =
    mode === 'edit' && transaction?.tag ? transaction.tag : DEFAULT_TAG;

  const [createState, createAction, isCreatePending] = useActionState(createManualTransactionAction, {});
  const [tag, setTag] = useState<ShoppingTransactionTag>(initialTag);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditPending, setIsEditPending] = useState(false);

  const defaultAmount = mode === 'edit' && transaction ? String(transaction.total_amount) : '';
  const defaultDescription =
    mode === 'edit' && transaction?.store_name ? transaction.store_name : '';
  const defaultDate =
    mode === 'edit' && transaction?.transaction_date
      ? transaction.transaction_date
      : today;

  const title = mode === 'edit' ? 'Editar gasto manual' : 'Registrar gasto manual';
  const isPending = mode === 'edit' ? isEditPending : isCreatePending;
  const errorMessage = mode === 'edit' ? editError : createState.error;

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!transaction) return;

    const formData = new FormData(e.currentTarget);
    const store = (formData.get('description') as string) || null;
    const date = formData.get('date') as string;
    const total = parseFloat(formData.get('amount') as string);
    const tagValue = formData.get('tag') as ShoppingTransactionTag;

    setIsEditPending(true);
    setEditError(null);

    const result = await updateManualTransactionAction(transaction.id, {
      store,
      date,
      total,
      tag: tagValue,
    });

    setIsEditPending(false);

    if (!result.ok) {
      setEditError(result.error);
      return;
    }

    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {errorMessage && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {errorMessage}
          </div>
        )}

        <form
          action={mode === 'create' ? createAction : undefined}
          onSubmit={mode === 'edit' ? handleEditSubmit : undefined}
          className="flex flex-col gap-2"
        >
          <div className="flex gap-2">
            <div className="flex w-28 shrink-0 flex-col gap-1">
              <label htmlFor="modal-amount" className="text-xs font-medium text-gray-600">
                Monto
              </label>
              <input
                id="modal-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                defaultValue={defaultAmount}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
              />
            </div>

            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="modal-description" className="text-xs font-medium text-gray-600">
                Descripción (opcional)
              </label>
              <input
                id="modal-description"
                name="description"
                type="text"
                placeholder="Ej: Farmacia"
                defaultValue={defaultDescription}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Tipo de compra</span>
            <div role="group" aria-label="Tipo de compra" className="flex flex-wrap gap-2">
              {SHOPPING_TRANSACTION_TAGS.map((t) => {
                const selected = tag === t;
                const className = selected
                  ? 'rounded-lg border border-[var(--color-brand)] bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700';
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTag(t)}
                    className={className}
                  >
                    {TAG_LABELS[t]}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="tag" value={tag} />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="modal-date" className="text-xs font-medium text-gray-600">
                Fecha
              </label>
              <input
                id="modal-date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand)] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending
                ? mode === 'edit' ? 'Guardando...' : 'Registrando...'
                : mode === 'edit' ? 'Guardar' : 'Registrar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
