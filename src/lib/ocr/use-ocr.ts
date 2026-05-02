'use client';

import { useState } from 'react';
import type { ParsedTicketItem } from '@/lib/parsers/types';

interface OcrResult {
  items: ParsedTicketItem[];
  isProcessing: boolean;
  progress: number;
  error: string | null;
}

interface OcrActions {
  recognize: (file: File) => Promise<ParsedTicketItem[]>;
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

  async function recognize(file: File): Promise<ParsedTicketItem[]> {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setItems([]);

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

        if (parsed.length === 0) {
          setError('No se reconoció el supermercado. Probá importar el PDF.');
        }
      } catch {
        setError('No se reconoció el supermercado. Probá importar el PDF.');
        return [];
      }

      setItems(parsed);
      return parsed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al procesar la imagen';
      setError(msg);
      return [];
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }

  function reset() {
    setItems([]);
    setError(null);
    setProgress(0);
    setIsProcessing(false);
  }

  return { items, isProcessing, progress, error, recognize, reset };
}
