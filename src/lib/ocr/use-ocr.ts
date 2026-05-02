'use client';

import { useState } from 'react';
import type { ParsedTicketItem } from '@/lib/parsers/types';

interface OcrResult {
  items: ParsedTicketItem[];
  isProcessing: boolean;
  progress: number;
  error: string | null;
  /** Raw text extracted by Tesseract — populated even when no parser matched. */
  rawText: string | null;
}

interface OcrActions {
  recognize: (file: File) => Promise<{ items: ParsedTicketItem[]; rawText: string | null; error: string | null }>;
  /** Retry parsing with a known parser hint (e.g. 'mercadona'). Requires rawText to be set. */
  retryWithHint: (hint: string) => Promise<{ items: ParsedTicketItem[]; error: string | null }>;
  reset: () => void;
}

interface ParseTicketTextResponse {
  items: ParsedTicketItem[];
  parser: string | null;
  message?: string;
}

export function useOcr(): OcrResult & OcrActions {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedTicketItem[]>([]);
  const [rawText, setRawText] = useState<string | null>(null);

  async function recognize(file: File): Promise<{ items: ParsedTicketItem[]; rawText: string | null; error: string | null }> {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setItems([]);
    setRawText(null);

    try {
      // Dynamic import avoids SSR issues — tesseract.js uses browser APIs (Worker, Blob)
      const { createWorker } = await import('tesseract.js');

      const worker = await createWorker('spa', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data } = await worker.recognize(file);
      await worker.terminate();

      // Always store raw text so the page can offer a hint-based retry
      setRawText(data.text);

      let parsed: ParsedTicketItem[] = [];

      try {
        const res = await fetch('/api/parse-ticket-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.text }),
        });

        if (!res.ok) {
          throw new Error(`API error ${res.status}`);
        }

        const result = (await res.json()) as ParseTicketTextResponse;
        parsed = result.items ?? [];
      } catch {
        const err = 'Error al contactar el servidor. Intentá de nuevo.';
        setError(err);
        return { items: [], rawText: data.text, error: err };
      }

      if (parsed.length === 0) {
        // Return rawText without setting error — the page decides what to show
        return { items: [], rawText: data.text, error: null };
      }

      setItems(parsed);
      return { items: parsed, rawText: data.text, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al procesar la imagen';
      setError(msg);
      return { items: [], rawText: null, error: msg };
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }

  async function retryWithHint(hint: string): Promise<{ items: ParsedTicketItem[]; error: string | null }> {
    if (!rawText) {
      return { items: [], error: 'No hay texto OCR disponible para reintentar.' };
    }

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/parse-ticket-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, hint }),
      });

      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }

      const result = (await res.json()) as ParseTicketTextResponse;
      const parsed = result.items ?? [];

      if (parsed.length === 0) {
        const err = 'No se encontraron productos para este supermercado.';
        setError(err);
        return { items: [], error: err };
      }

      setItems(parsed);
      return { items: parsed, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reintentar el análisis';
      setError(msg);
      return { items: [], error: msg };
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    setItems([]);
    setError(null);
    setProgress(0);
    setIsProcessing(false);
    setRawText(null);
  }

  return { items, isProcessing, progress, error, rawText, recognize, retryWithHint, reset };
}
