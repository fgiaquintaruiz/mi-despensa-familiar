'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { categoryLabel, isLowStock } from '@/lib/types';
import type { Product } from '@/lib/types';
import DeleteProductButton from './DeleteProductButton';
import ConsumeButton from './ConsumeButton';
import RestockButton from './RestockButton';
import { bulkDeleteProductsAction } from '../actions';

interface Props {
  products: Product[];
}

function getExpiryStatus(expiresAt: string | null) {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Vencido', color: 'text-red-600 bg-red-50' };
  if (days <= 3) return { label: `Vence en ${days}d`, color: 'text-orange-600 bg-orange-50' };
  if (days <= 7) return { label: `Vence en ${days}d`, color: 'text-yellow-600 bg-yellow-50' };
  return { label: `Vence ${new Date(expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`, color: 'text-green-600 bg-green-50' };
}

export default function ProductList({ products }: Props) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  if (products.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-gray-400">Sin productos</p>
    );
  }

  const allSelected = selectedIds.size === products.length;

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  async function handleBulkDelete() {
    setBulkError(null);
    const ids = [...selectedIds];
    const result = await bulkDeleteProductsAction(ids);
    if (result.error) {
      setBulkError(result.error);
      return;
    }
    setSelectedIds(new Set());
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3">
          <span className="text-sm font-medium text-red-700">
            {selectedIds.size} {selectedIds.size === 1 ? 'producto seleccionado' : 'productos seleccionados'}
          </span>
          <div className="flex items-center gap-2">
            {bulkError && <span className="text-xs text-red-600">{bulkError}</span>}
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isPending ? 'Eliminando...' : `Eliminar seleccionados (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <input
          type="checkbox"
          id="select-all"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-gray-300 text-[var(--color-brand)]"
        />
        <label htmlFor="select-all" className="text-xs text-gray-500 select-none cursor-pointer">
          {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </label>
      </div>

      <ul className="mt-2 space-y-2">
        {products.map((product) => (
          <li
            key={product.id}
            className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                data-product-id={product.id}
                checked={selectedIds.has(product.id)}
                onChange={() => toggleProduct(product.id)}
                className="h-4 w-4 rounded border-gray-300 text-[var(--color-brand)]"
                aria-label={`Seleccionar ${product.name}`}
              />
              <div>
                <p className="font-medium">{product.name}</p>
                {product.brand && (
                  <p className="text-xs text-gray-400">{product.brand}</p>
                )}
                <p className="text-xs text-gray-500">{categoryLabel(product.category)}</p>
                <p className="text-xs text-gray-400">
                  Agregado el{' '}
                  {new Date(product.created_at).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
                {(() => {
                  const expiry = getExpiryStatus(product.expires_at);
                  return expiry ? (
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${expiry.color}`}>
                      {expiry.label}
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ConsumeButton productId={product.id} currentStock={product.current_stock} />
              <span className="text-sm font-semibold">{product.current_stock}</span>
              <RestockButton productId={product.id} />
              {isLowStock(product) && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium leading-none text-orange-600">
                  stock bajo
                </span>
              )}
              <Link
                href={`/products/${product.id}/edit`}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-brand)] hover:bg-blue-50"
                aria-label={`Editar ${product.name}`}
              >
                Editar
              </Link>
              <DeleteProductButton productId={product.id} productName={product.name} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
