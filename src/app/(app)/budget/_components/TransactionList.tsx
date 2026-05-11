'use client';

import React, { useState } from 'react';
import type { BudgetCurrency, ShoppingTransaction, TransactionItem } from '@/lib/types';
import { formatAmount } from '@/lib/currency';
import { getTransactionItemsAction } from '../actions';
import DeleteTransactionButton from './DeleteTransactionButton';

interface TransactionListProps {
  transactions: ShoppingTransaction[];
  currency: BudgetCurrency;
  onEditTransaction?: (tx: ShoppingTransaction) => void;
}

export default function TransactionList({ transactions, currency, onEditTransaction }: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Map<string, TransactionItem[]>>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorCache, setErrorCache] = useState<Map<string, string>>(new Map());

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Sin compras registradas en este período.
      </div>
    );
  }

  async function handleRowClick(tx: ShoppingTransaction) {
    if (expandedId === tx.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(tx.id);

    if (!itemsCache.has(tx.id)) {
      setLoadingId(tx.id);
      const result = await getTransactionItemsAction(tx.id);
      if (result.error) {
        setErrorCache((prev) => new Map(prev).set(tx.id, result.error!));
      } else {
        setItemsCache((prev) => new Map(prev).set(tx.id, result.data ?? []));
      }
      setLoadingId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-left">Tienda</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Items</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => (
            <React.Fragment key={tx.id}>
              <tr
                onClick={() => handleRowClick(tx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { handleRowClick(tx); } }}
                role="button"
                tabIndex={0}
                className="cursor-pointer hover:bg-gray-50"
                aria-expanded={expandedId === tx.id}
              >
                <td className="px-4 py-3 text-gray-600">{tx.transaction_date}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {tx.store_name ?? '(Sin tienda)'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {formatAmount(tx.total_amount, currency)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{tx.item_count}</td>
              </tr>
              {expandedId === tx.id && (
                <tr key={`${tx.id}-detail`}>
                  <td colSpan={4} className="bg-gray-50 px-4 py-3">
                    {loadingId === tx.id ? (
                      <p className="text-xs text-gray-400">Cargando items...</p>
                    ) : errorCache.has(tx.id) ? (
                      <p className="text-sm text-red-500">Error al cargar items</p>
                    ) : (
                      <ItemsDetail items={itemsCache.get(tx.id) ?? []} currency={currency} />
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      {tx.source === 'manual' && onEditTransaction && (
                        <button
                          type="button"
                          aria-label="Editar gasto"
                          onClick={(e) => { e.stopPropagation(); onEditTransaction(tx); }}
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      <DeleteTransactionButton
                        transactionId={tx.id}
                        storeName={tx.store_name}
                        totalAmount={tx.total_amount}
                        currency={currency}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemsDetail({ items, currency }: { items: TransactionItem[]; currency: BudgetCurrency }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-400">Sin items registrados.</p>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between text-xs text-gray-700">
          <span>
            {item.product_name}
            {item.product_id === null && (
              <span className="ml-1 text-gray-400">(Producto desconocido)</span>
            )}
          </span>
          <span className="font-medium">
            {item.quantity} × {formatAmount(item.unit_price, currency)} = {formatAmount(item.line_total, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
