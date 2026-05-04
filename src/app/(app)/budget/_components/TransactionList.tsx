'use client';

import { useState } from 'react';
import type { ShoppingTransaction, TransactionItem } from '@/lib/types';
import { getTransactionItemsAction } from '../actions';

interface TransactionListProps {
  transactions: ShoppingTransaction[];
  budgetId: string;
}

function formatAmount(amount: number): string {
  return `$${new Intl.NumberFormat('es-AR').format(Math.round(amount))}`;
}

export default function TransactionList({ transactions }: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Map<string, TransactionItem[]>>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
      setItemsCache((prev) => new Map(prev).set(tx.id, result.data ?? []));
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
            <>
              <tr
                key={tx.id}
                onClick={() => handleRowClick(tx)}
                className="cursor-pointer hover:bg-gray-50"
                aria-expanded={expandedId === tx.id}
              >
                <td className="px-4 py-3 text-gray-600">{tx.transaction_date}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {tx.store_name ?? '(Sin tienda)'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {formatAmount(tx.total_amount)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">{tx.item_count}</td>
              </tr>
              {expandedId === tx.id && (
                <tr key={`${tx.id}-detail`}>
                  <td colSpan={4} className="bg-gray-50 px-4 py-3">
                    {loadingId === tx.id ? (
                      <p className="text-xs text-gray-400">Cargando items...</p>
                    ) : (
                      <ItemsDetail items={itemsCache.get(tx.id) ?? []} />
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemsDetail({ items }: { items: TransactionItem[] }) {
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
            {item.quantity} × {formatAmount(item.unit_price)} = {formatAmount(item.line_total)}
          </span>
        </li>
      ))}
    </ul>
  );
}
