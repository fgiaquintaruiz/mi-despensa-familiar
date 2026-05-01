'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, categoryLabel, type Category } from '@/lib/types';
import { addProductAction } from '../actions';

export default function AddProductSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [stock, setStock] = useState(1);
  const [name, setName] = useState('');

  const [state, formAction] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await addProductAction(prev, fd);
      if (!result.error) {
        setOpen(false);
        setName('');
        setSelectedCategory(null);
        setStock(1);
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  function handleClose() {
    setOpen(false);
    setName('');
    setSelectedCategory(null);
    setStock(1);
  }

  const canSubmit = name.trim().length > 0 && selectedCategory !== null;

  return (
    <>
      <button
        type="button"
        aria-label="+"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)] text-2xl font-bold text-white shadow-lg"
      >
        +
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40"
            aria-hidden="true"
            onClick={handleClose}
          />

          <div className="fixed inset-x-0 bottom-0 rounded-t-2xl bg-white p-6 shadow-xl">
            <form action={formAction}>
              <input type="hidden" name="current_stock" value={stock} />
              {selectedCategory && (
                <input type="hidden" name="category" value={selectedCategory} />
              )}

              <div className="mb-4">
                <label htmlFor="product-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre del producto
                </label>
                <input
                  id="product-name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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

              <div className="mb-6">
                <p className="mb-2 text-sm font-medium text-gray-700">Cantidad inicial</p>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    aria-label="Decrementar cantidad"
                    onClick={() => setStock((s) => Math.max(1, s - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700"
                  >
                    −
                  </button>
                  <span data-testid="stock-counter" className="min-w-[2rem] text-center text-lg font-semibold">
                    {stock}
                  </span>
                  <button
                    type="button"
                    aria-label="Incrementar cantidad"
                    onClick={() => setStock((s) => s + 1)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-700"
                  >
                    +
                  </button>
                </div>
              </div>

              {state?.error && (
                <p className="mb-4 text-sm text-red-600">{state.error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-gray-300 py-3 font-medium text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 rounded-xl bg-[var(--color-brand)] py-3 font-medium text-white disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
