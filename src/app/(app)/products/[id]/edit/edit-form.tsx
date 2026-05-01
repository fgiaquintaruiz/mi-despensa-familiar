'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, categoryLabel, type Category } from '@/lib/types';
import type { Product } from '@/lib/types';
import { updateProductAction } from '../../../actions';

interface Props {
  product: Product;
}

export default function EditForm({ product }: Props) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [selectedCategory, setSelectedCategory] = useState<Category>(product.category);
  const [stock, setStock] = useState(product.current_stock);
  const [minStock, setMinStock] = useState(product.min_stock);

  const [state, formAction] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await updateProductAction(prev, fd);
      if (!result.error) {
        router.push('/');
      }
      return result;
    },
    undefined,
  );

  const canSubmit = name.trim().length > 0;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="current_stock" value={stock} />
      <input type="hidden" name="min_stock" value={minStock} />
      <input type="hidden" name="category" value={selectedCategory} />

      <div className="mb-4">
        <label htmlFor="edit-name" className="mb-1 block text-sm font-medium text-gray-700">
          Nombre del producto
        </label>
        <input
          id="edit-name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="edit-brand" className="mb-1 block text-sm font-medium text-gray-700">
          Marca
        </label>
        <input
          id="edit-brand"
          name="brand"
          type="text"
          defaultValue={product.brand ?? ''}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
        />
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Categoría</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedCategory(cat.key as Category)}
                className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {categoryLabel(cat.key as Category)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="edit-unit" className="mb-1 block text-sm font-medium text-gray-700">
          Unidad
        </label>
        <input
          id="edit-unit"
          name="unit"
          type="text"
          defaultValue={product.unit ?? ''}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
        />
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Stock actual</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Decrementar cantidad actual"
            onClick={() => setStock((s) => Math.max(0, s - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700"
          >
            −
          </button>
          <span data-testid="stock-counter" className="min-w-[2rem] text-center text-lg font-semibold">
            {stock}
          </span>
          <button
            type="button"
            aria-label="Incrementar cantidad actual"
            onClick={() => setStock((s) => s + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700"
          >
            +
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Stock mínimo</p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Decrementar stock mínimo"
            onClick={() => setMinStock((s) => Math.max(0, s - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center text-lg font-semibold">
            {minStock}
          </span>
          <button
            type="button"
            aria-label="Incrementar stock mínimo"
            onClick={() => setMinStock((s) => s + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700"
          >
            +
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="edit-price" className="mb-1 block text-sm font-medium text-gray-700">
          Precio
        </label>
        <input
          id="edit-price"
          name="price"
          type="number"
          min="0"
          step="0.01"
          defaultValue={product.price}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
        />
      </div>

      {state?.error && (
        <p className="mb-4 text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex-1 rounded-xl border border-gray-300 py-3 font-medium text-gray-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 rounded-xl bg-[var(--color-brand)] py-3 font-medium text-white disabled:opacity-40"
        >
          Guardar cambios
        </button>
      </div>
    </form>
  );
}
