'use client';

import { useRef, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import type { Category } from '@/lib/types';
import { importTicketItemsAction } from '../actions';
import { useOcr } from '@/lib/ocr/use-ocr';

function ModeCTA({
  pdfInputRef,
  photoInputRef,
}: {
  pdfInputRef: React.RefObject<HTMLInputElement | null>;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');

  if (mode === 'photo') {
    return (
      <button
        onClick={() => photoInputRef.current?.click()}
        className="w-full rounded-xl bg-[var(--color-brand)] mb-4 py-4 text-lg font-bold text-white active:opacity-80"
      >
        📷 Toca aquí para abrir la cámara
      </button>
    );
  }

  if (mode === 'pdf') {
    return (
      <button
        onClick={() => pdfInputRef.current?.click()}
        className="w-full rounded-xl bg-[var(--color-brand)] mb-4 py-4 text-lg font-bold text-white active:opacity-80"
      >
        📄 Toca aquí para seleccionar el PDF
      </button>
    );
  }

  return null;
}

interface TicketItem {
  name: string;
  qty: number;
  price: number;
  category: Category;
}

interface ItemRow extends TicketItem {
  selected: boolean;
}

type SupermarketHint = 'mercadona' | 'carrefour' | 'aldi' | 'otro';

const HINT_BUTTONS: { label: string; value: SupermarketHint }[] = [
  { label: 'Mercadona', value: 'mercadona' },
  { label: 'Carrefour', value: 'carrefour' },
  { label: 'Aldi', value: 'aldi' },
  { label: 'Otro', value: 'otro' },
];

export default function ImportTicketPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingSource, setAnalyzingSource] = useState<'pdf' | 'photo' | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const [noDetection, setNoDetection] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  /** Set when OCR succeeded but no parser matched — triggers the hint selector. */
  const [showHintSelector, setShowHintSelector] = useState(false);
  /** 'otro' reveals the manual text area; other values trigger a hint retry. */
  const [selectedHint, setSelectedHint] = useState<SupermarketHint | null>(null);
  /** Free-form product lines typed by the user when 'Otro' is selected. */
  const [manualText, setManualText] = useState('');
  const ocr = useOcr();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setAnalyzingSource('pdf');
    setRows([]);
    setNoDetection(false);
    setImported(null);
    setImportError(null);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/analyze-ticket', { method: 'POST', body: formData });
    const data = await res.json();

    setAnalyzing(false);
    setAnalyzingSource(null);

    if (!data.items || data.items.length === 0) {
      setNoDetection(true);
      return;
    }

    setRows((data.items as TicketItem[]).map((item) => ({ ...item, selected: true })));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setAnalyzingSource('photo');
    setRows([]);
    setNoDetection(false);
    setImported(null);
    setImportError(null);
    setShowHintSelector(false);
    setSelectedHint(null);
    setManualText('');

    const { items, error: ocrError } = await ocr.recognize(file);

    setAnalyzing(false);
    setAnalyzingSource(null);

    if (ocrError) {
      setImportError(ocrError);
      return;
    }

    if (items.length === 0) {
      // OCR worked but no parser matched — let the user pick the store
      setShowHintSelector(true);
      return;
    }

    setRows((items as TicketItem[]).map((item) => ({ ...item, selected: true })));
  }

  async function handleHintSelect(hint: SupermarketHint) {
    setSelectedHint(hint);
    if (hint === 'otro') return; // shows the manual text area, no API call yet

    setImportError(null);
    const { items, error } = await ocr.retryWithHint(hint);
    if (error) {
      setImportError(error);
      return;
    }
    setShowHintSelector(false);
    setRows((items as TicketItem[]).map((item) => ({ ...item, selected: true })));
  }

  async function handleManualSubmit() {
    if (!manualText.trim()) return;
    setImportError(null);

    try {
      const res = await fetch('/api/parse-ticket-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: manualText }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = await res.json() as { items?: TicketItem[]; error?: string };
      const items = data.items ?? [];

      if (items.length === 0) {
        setImportError('No se encontraron productos en el texto ingresado.');
        return;
      }

      setShowHintSelector(false);
      setSelectedHint(null);
      setRows(items.map((item) => ({ ...item, selected: true })));
    } catch {
      setImportError('Error al procesar el texto. Intentá de nuevo.');
    }
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
      <Suspense fallback={null}>
        <ModeCTA pdfInputRef={inputRef} photoInputRef={photoRef} />
      </Suspense>
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm font-medium text-[var(--color-brand)] hover:opacity-75"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver
      </button>
      <h1 className="text-2xl font-extrabold text-[var(--color-brand)]">Importar ticket</h1>

      <div className="flex gap-3">
        <label className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-[var(--color-brand)] px-4 py-6 text-center font-semibold text-[var(--color-brand)]">
          Subir PDF
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>

        <label className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-[var(--color-brand)] px-4 py-6 text-center font-semibold text-[var(--color-brand)] flex flex-col items-center justify-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.172a2 2 0 001.414-.586l.828-.828A2 2 0 0110.172 5h3.656a2 2 0 011.414.586l.828.828A2 2 0 0017.828 7H18a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Foto de ticket
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handlePhotoChange}
          />
        </label>
      </div>

      {analyzing && (
        <p className="text-sm text-gray-500">
          {analyzingSource === 'photo'
            ? ocr.progress > 0
              ? `Procesando imagen... ${ocr.progress}%`
              : 'Cargando motor OCR...'
            : 'Analizando PDF...'}
        </p>
      )}

      {noDetection && (
        <p className="text-sm text-amber-600">
          No se detectaron productos. ¿El PDF es de Mercadona?
        </p>
      )}

      {showHintSelector && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            No se reconoció el supermercado automáticamente. ¿De qué tienda es el ticket?
          </p>
          <div className="flex flex-wrap gap-2">
            {HINT_BUTTONS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleHintSelect(value)}
                disabled={ocr.isProcessing}
                className={[
                  'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
                  selectedHint === value
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                    : 'border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {ocr.isProcessing && (
            <p className="text-xs text-amber-700">Reintentando con el parser seleccionado...</p>
          )}

          {selectedHint === 'otro' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-amber-700">
                Ingresá las líneas del ticket (una por línea). Formato sugerido: nombre, cantidad, precio.
              </p>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={6}
                placeholder={'Leche entera 1L x2 1.49\nPan de molde x1 1.25\n...'}
                className="w-full rounded-lg border border-gray-300 p-2 text-sm font-mono focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualText.trim()}
                className="self-end rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Procesar texto
              </button>
            </div>
          )}
        </div>
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
