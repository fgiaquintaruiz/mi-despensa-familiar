'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Category } from '@/lib/types';
import { importTicketItemsAction } from '../actions';

interface TicketItem {
  name: string;
  qty: number;
  price: number;
  category: Category;
}

interface ItemRow extends TicketItem {
  selected: boolean;
}

export default function ImportTicketPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [noDetection, setNoDetection] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setRows([]);
    setNoDetection(false);
    setImported(null);
    setImportError(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/analyze-ticket', { method: 'POST', body: formData });
    const data = await res.json();

    setAnalyzing(false);

    if (!data.items || data.items.length === 0) {
      setNoDetection(true);
      return;
    }

    setRows((data.items as TicketItem[]).map((item) => ({ ...item, selected: true })));
  }

  function toggleRow(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)),
    );
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected).map(({ name, qty, price, category }) => ({
      name,
      qty,
      price,
      category,
    }));

    setImporting(true);
    const result = await importTicketItemsAction(selected);
    setImporting(false);

    if (result.error) {
      setImportError(result.error);
      return;
    }

    setImported(result.imported);
  }

  if (imported !== null) {
    return (
      <main className="mx-auto max-w-[480px] px-5 py-8 flex flex-col gap-4">
        <p className="text-lg font-semibold text-green-600">{imported} productos importados</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-white font-semibold"
        >
          Volver al dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[480px] px-5 py-8 flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-[var(--color-brand)]">Importar ticket</h1>

      <label className="cursor-pointer rounded-lg border-2 border-dashed border-[var(--color-brand)] px-4 py-6 text-center font-semibold text-[var(--color-brand)]">
        Seleccionar ticket PDF
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="sr-only"
          onChange={handleFileChange}
        />
      </label>

      {analyzing && <p className="text-sm text-gray-500">Analizando PDF...</p>}

      {noDetection && (
        <p className="text-sm text-amber-600">
          No se detectaron productos. ¿El PDF es de Mercadona?
        </p>
      )}

      {importError && <p className="text-sm text-red-600">{importError}</p>}

      {rows.length > 0 && (
        <>
          <ul className="flex flex-col gap-2">
            {rows.map((row, idx) => (
              <li key={idx} className="flex items-center gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() => toggleRow(idx)}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                <span className="flex-1 text-sm font-medium">{row.name}</span>
                <span className="text-xs text-gray-500">x{row.qty}</span>
                <span className="text-xs text-gray-500">{row.price.toFixed(2)} €</span>
                <span className="text-xs text-gray-400">{row.category}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleImport}
            disabled={importing || rows.every((r) => !r.selected)}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-white font-semibold disabled:opacity-50"
          >
            {importing ? 'Importando...' : 'Importar seleccionados'}
          </button>
        </>
      )}
    </main>
  );
}
