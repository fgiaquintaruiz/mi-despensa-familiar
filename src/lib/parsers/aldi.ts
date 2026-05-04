import type { TicketParser, ParsedTicketItem } from './types';
import type { Category } from '@/lib/types';

/**
 * Aldi ticket format:
 *
 *   NOMBRE_PRODUCTO    PRECIO € IVA_CATEGORIA
 *
 * Example:
 *   PANELA BIO                    1,99 € 3
 *
 * The trailing single digit is the IVA group — NOT quantity.
 * Quantity is always 1 (Aldi basic tickets do not show qty).
 * Price uses comma as decimal separator.
 * "A PAGAR" line is the total — skipped.
 * IVA table lines (lines containing "IVA", "BASE IMP", "CUOTA") — skipped.
 * Payment / footer lines (OPERACION CONTACTLESS, GRACIAS POR TU COMPRA) — skipped.
 */

const CATEGORY_KEYWORDS: Array<[string[], Category]> = [
  [
    [
      'LECHE', 'YOGUR', 'NATA', 'QUESO', 'MANTEQUILLA', 'HUEVO', 'CARNE', 'POLLO',
      'BURGER', 'PIZZA', 'NUGGETS', 'JAMON', 'CHORIZO', 'SALMON', 'ATUN',
      'VERDURA', 'FRUTA', 'ESPINACA', 'CEBOLLA', 'TOMATE', 'LECHUGA', 'ZANAHORIA',
      'PATATA', 'PLATANO', 'MANZANA', 'NARANJA', 'PERA',
    ],
    'frescos',
  ],
  [
    [
      'PAN', 'GALLETA', 'PASTA', 'ARROZ', 'CONSERVA', 'ACEITE', 'MASA', 'HARINA',
      'AZUCAR', 'SAL', 'CAFE', 'COLA', 'REFRESCO', 'AGUA', 'ZUMO', 'BRIOCHE',
      'MIEL', 'PANELA', 'CEREALES', 'CHOCOLATE', 'MERMELADA', 'VINAGRE',
    ],
    'despensa',
  ],
  [
    ['LIMPIA', 'DETERGENTE', 'SUAVIZANTE', 'FREGASUELOS', 'BAYETA', 'CRISTAL', 'MULTIUSO'],
    'limpieza',
  ],
  [
    ['CHAMPU', 'GEL', 'JABON', 'COLONIA', 'CREMA', 'DENTO', 'HIGIENE'],
    'higiene',
  ],
  [['BEBE', 'PAÑAL', 'TOALLITA'], 'bebe'],
  [['MEDICAMENTO', 'PARACETAMOL', 'IBUPROFENO', 'VITAMINA'], 'farmacia'],
];

function mapCategory(name: string): Category {
  const upper = name.toUpperCase();
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => upper.includes(k))) return category;
  }
  return 'despensa';
}

/**
 * Matches a product line: NAME   PRICE € IVA_GROUP
 * - NAME: one or more words (letters, digits, accented chars, hyphens)
 * - PRICE: digits,digits (comma decimal separator)
 * - € literal (optional — OCR may drop it entirely)
 * - IVA_GROUP: single digit (tax group — ignored, optional for OCR-noisy input)
 *
 * Supports two tolerance levels to handle Tesseract garbling:
 *   STRICT  (preferred): NAME \s{2,} PRICE \s+ [€E] optional-IVA trailing-noise
 *   LENIENT (fallback):  NAME \s+    PRICE \s* [€E]? optional-IVA trailing-noise
 *
 * "Trailing noise" covers OCR artifacts like ": ha" or "o" after the price.
 *
 * Examples:
 *   Clean:   "PANELA BIO                    1,99 € 3"
 *   Garbled: "a PANELA BÍO d 1,99 € 3 : ha"
 */
const ITEM_REGEX_STRICT  = /^(.+?)\s{2,}(\d+,\d{2})\s+[€E](\s+\d)?\s*.*$/;
const ITEM_REGEX_LENIENT = /^(.+?)\s+(\d+,\d{2})\s*[€E]?(\s+\d)?\s*.*$/;

/**
 * Normalize OCR-noisy text before regex matching.
 * Handles two common Tesseract artifacts:
 *  1. Decimal point instead of comma: "1.99" → "1,99"
 *  2. Garbled € symbol (e, E, ε) → "€" (only when preceded by digit/space)
 */
function preprocessText(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      // Normalize decimal point → comma (only when exactly 2 decimal digits follow)
      line = line.replace(/(\d)\.(\d{2})(?!\d)/g, '$1,$2');
      // Normalize garbled € variants preceded by digit/space
      line = line.replace(/(?<=[\d\s])[eE€ε](?=\s)/g, '€');
      return line;
    })
    .join('\n');
}

function parseEuro(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

function toTitleCase(name: string): string {
  // \b doesn't fire between digits and letters (both are \w),
  // so we also uppercase letters that immediately follow a digit.
  return name
    .toLowerCase()
    .replace(/(^|[\s\d])([a-z])/g, (_, prefix: string, letter: string) => prefix + letter.toUpperCase());
}

const SKIP_PATTERNS = [
  /A\s+PAGAR/i,
  /TOTAL/i,
  /IVA/i,
  /BASE\s+IMP/i,
  /CUOTA/i,
  /OPERACION\s+CONTACTLESS/i,
  /GRACIAS\s+POR\s+TU\s+COMPRA/i,
  /EFECTIVO/i,
  /CAMBIO/i,
  /TARJETA/i,
  /TICKET/i,
  /^\s*ALDI\b/i,
  // IVA table data rows: lines starting with a percentage (e.g. " 4%   0,89   0,04   0,93")
  /^\s*\d+%/,
];

function shouldSkip(line: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(line));
}

/**
 * Strip leading/trailing single-character OCR noise tokens from a product name.
 * Tesseract occasionally prepends ("a ", "a. ") or appends (" d", " o") isolated
 * characters that are artefacts of scanning, not part of the actual product name.
 *
 * A token is considered noise if it is a single letter (possibly followed by
 * punctuation) at the very start or end of the name.
 *
 * Example: "a PANELA BÍO d"  →  "PANELA BÍO"
 *          "a. A PAR"        →  "A PAR"
 */
function cleanOcrName(name: string): string {
  // Remove leading single-letter (+ optional punctuation) token
  let cleaned = name.replace(/^[a-záéíóúüñ]\.*\s+/i, '');
  // Remove trailing single-letter token
  cleaned = cleaned.replace(/\s+[a-záéíóúüñ]\.?$/i, '');
  return cleaned.trim() || name.trim(); // fall back to original if cleaning empties the string
}

/**
 * Returns false when a cleaned product name is clearly an OCR artefact:
 *   1. Fewer than 3 alphanumeric characters in total (e.g. "A.", "B")
 *   2. Pure number after trim (e.g. "3", "42")
 *   3. Every space-separated token has length ≤ 1 (e.g. "A B", "X Y Z")
 *
 * Existing structural checks (alnum ratio, etc.) are preserved by the caller.
 */
function looksLikeProductName(name: string): boolean {
  const trimmed = name.trim();

  // Rule 1: fewer than 3 alnum characters total
  const alnumCount = (trimmed.match(/[a-z0-9áéíóúüñ]/gi) ?? []).length;
  if (alnumCount < 3) return false;

  // Rule 2: pure number
  if (/^\d+$/.test(trimmed)) return false;

  // Rule 3: all tokens are single characters
  const tokens = trimmed.split(/\s+/);
  if (tokens.every((t) => t.length <= 1)) return false;

  return true;
}

function extractItems(text: string): ParsedTicketItem[] {
  const lines = text.split('\n');
  const items: ParsedTicketItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (shouldSkip(trimmed)) continue;

    const match = ITEM_REGEX_STRICT.exec(trimmed) ?? ITEM_REGEX_LENIENT.exec(trimmed);
    if (!match) continue;

    const rawName = cleanOcrName(match[1].trim());
    if (!looksLikeProductName(rawName)) continue;
    const price = parseEuro(match[2]);

    items.push({
      name: toTitleCase(rawName),
      qty: 1,
      unit: 'ud',
      price,
      category: mapCategory(rawName),
    });
  }

  return items;
}

export const aldiParser: TicketParser = {
  store: 'Aldi',
  canParse: ({ filename, text }) => {
    const haystack = `${filename ?? ''} ${text ?? ''}`;
    return /a\s*l\s*d\s*i/i.test(haystack) || /4ldi/i.test(haystack);
  },
  parse: async ({ text = '' }) => {
    const normalized = preprocessText(text);
    return extractItems(normalized);
  },
};
