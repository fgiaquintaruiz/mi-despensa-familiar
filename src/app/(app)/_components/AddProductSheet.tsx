'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, categoryLabel, type Category } from '@/lib/types';
import { addProductAction } from '../actions';
import { lookupBarcode } from '@/lib/barcode/open-food-facts';
import { useBarcodeScanner } from '@/lib/barcode/use-barcode-scanner';
import BarcodeScanner from './BarcodeScanner';

interface AddProductSheetProps {
  open?: boolean;
  onClose?: () => void;
}

export default function AddProductSheet({ open: openProp, onClose }: AddProductSheetProps = {}) {
  const router = useRouter();
  const isControlled = openProp !== undefined;
  const [openInternal, setOpenInternal] = useState(false);
  const open = isControlled ? openProp : openInternal;
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [stock, setStock] = useState(1);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState(0);
  const [barcode, setBarcode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const { isSupported } = useBarcodeScanner(() => {});

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function cancelCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setAutoSaveCountdown(null);
  }

  function closeSheet() {
    if (isControlled) {
      onClose?.();
    } else {
      setOpenInternal(false);
    }
  }

  const [state, formAction] = useActionState(
    async (prev: unknown, fd: FormData) => {
      const result = await addProductAction(prev, fd);
      if (!result.error) {
        closeSheet();
        setName('');
        setBrand('');
        setPrice(0);
        setSelectedCategory(null);
        setStock(1);
        setBarcode('');
        setExpiresAt('');
        router.refresh();
      }
      return result;
    },
    undefined,
  );

  function handleClose() {
    cancelCountdown();
    closeSheet();
    setName('');
    setBrand('');
    setPrice(0);
    setSelectedCategory(null);
    setStock(1);
    setBarcode('');
    setExpiresAt('');
  }

  async function handleBarcodeScanned(scannedBarcode: string) {
    setScannerOpen(false);
    setBarcode(scannedBarcode);

    const product = await lookupBarcode(scannedBarcode);
    if (product) {
      setName(product.name);
      if (product.brand) setBrand(product.brand);
      if (product.category) {
        setSelectedCategory(product.category);
      }

      setAutoSaveCountdown(3);
      countdownRef.current = setInterval(() => {
        setAutoSaveCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownRef.current!);
            countdownRef.current = null;
            setTimeout(() => formRef.current?.requestSubmit(), 0);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }

  const canSubmit = name.trim().length > 0 && selectedCategory !== null;

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          aria-label="Agregar producto"
          onClick={() => setOpenInternal(true)}
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)] text-2xl font-bold text-white shadow-lg"
        >
          +
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40"
            aria-hidden="true"
            onClick={handleClose}
          />

          <div className="fixed inset-x-0 bottom-0 rounded-t-2xl bg-white p-6 shadow-xl">
            <form ref={formRef} action={formAction} onPointerDown={cancelCountdown}>
              <input type="hidden" name="current_stock" value={stock} />
              {selectedCategory && (
                <input type="hidden" name="category" value={selectedCategory} />
              )}
              {barcode && (
                <input type="hidden" name="barcode" value={barcode} />
              )}
              {expiresAt && (
                <input type="hidden" name="expires_at" value={expiresAt} />
              )}

              {autoSaveCountdown !== null && (
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between rounded-t-2xl bg-[var(--color-brand)] px-4 py-2 text-white">
                  <span className="text-sm font-medium">Guardando automáticamente...</span>
                  <span className="text-2xl font-bold">{autoSaveCountdown}</span>
                </div>
              )}

              <div className="mb-4">
                {isSupported && (
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                  >
                    📷 Escanear código
                  </button>
                )}
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
                <label htmlFor="product-brand" className="mb-1 block text-sm font-medium text-gray-700">
                  Marca <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  id="product-brand"
                  name="brand"
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Marca (opcional)"
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

              <div className="mb-4">
                <label htmlFor="product-price" className="mb-1 block text-sm font-medium text-gray-700">
                  Precio <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  id="product-price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="product-expires-at" className="mb-1 block text-sm font-medium text-gray-700">
                  Fecha de vencimiento <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <input
                  id="product-expires-at"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                />
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

      {scannerOpen && (
        <BarcodeScanner
          onScanned={handleBarcodeScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  );
}
