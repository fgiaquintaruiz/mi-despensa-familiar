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

// Price pattern: one or more digits, optional comma/dot separator, exactly 2 decimal digits
// Anchored to end of string to avoid matching partial numbers mid-name
const PRICE_RE = /(\d+[.,]\d{2})\s*€?\s*$/;

function parseOcrText(text: string): ParsedTicketItem[] {
  const items: ParsedTicketItem[] = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(PRICE_RE);
    if (!match) continue;

    const priceStr = match[1].replace(',', '.');
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) continue;

    // Everything before the price match is the product name
    const nameRaw = line.slice(0, line.length - match[0].length).trim();
    // Skip lines that are obviously totals/headers (very short or all caps labels)
    if (!nameRaw || nameRaw.length < 2) continue;
    const upperRatio = (nameRaw.match(/[A-Z]/g) ?? []).length / nameRaw.length;
    // Skip lines like "TOTAL", "IVA", "SUBTOTAL" (all caps, short)
    if (upperRatio > 0.8 && nameRaw.length < 12) continue;

    items.push({
      name: nameRaw,
      qty: 1,
      unit: 'ud',
      price,
      category: 'despensa',
    });
  }

  return items;
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

      const parsed = parseOcrText(data.text);
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
