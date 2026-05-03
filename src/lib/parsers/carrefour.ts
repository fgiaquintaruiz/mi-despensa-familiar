import type { TicketParser, ParsedTicketItem } from './types';
import type { Category } from '@/lib/types';

/**
 * Carrefour ticket — two supported formats:
 *
 * 1. PDF (spaced-character): every character is a separate space-separated token.
 *    e.g. "P L A T A N O 1 , 9 9" → name=PLATANO, price=1.99
 *    Detection: any product line contains single-char tokens separated by spaces.
 *
 * 2. OCR (plain text from image scan): normal words, price right-aligned on the
 *    SAME line as the PREVIOUS product name.  The Carrefour Alameda OCR quirk:
 *      Line N:   <price of product A>           (standalone price, no name)
 *      Line N+1: <name of product A>   <price of product B>
 *      Line N+2: <name of product B>            (name only, no price on this line)
 *    Detection: price tokens are "NNN,NN" (no inner spaces) and product tokens are
 *    full words rather than single characters.
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
      'MIEL', 'PASTEL', 'MARMO', 'COCA',
    ],
    'despensa',
  ],
  [
    ['LIMPIA', 'DETERGENTE', 'SUAVIZANTE', 'FREGASUELOS', 'BAYETA', 'CRISTAL', 'MULTIUSO'],
    'limpieza',
  ],
  [
    ['CHAMPU', 'GEL', 'JABON', 'COLONIA', 'CREMA', 'DENTO', 'BAÑO', 'FLORAL'],
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

interface SpacedLineResult {
  name: string;
  price: number;
}

/**
 * Parse a raw Carrefour spaced-character line.
 *
 * Each character is a separate token separated by a single space.
 * The price occupies the last 4 tokens: <integer> <,> <decimal1> <decimal2>
 * Example: "P L A T A N O 1 , 9 9" → name="PLATANO", price=1.99
 *
 * Returns null for separator lines, header/footer lines, or any line that
 * does not match the price-suffix pattern.
 */
function parseSpacedLine(line: string): SpacedLineResult | null {
  const tokens = line.trim().split(' ');
  if (tokens.length < 5) return null;

  const n = tokens.length;
  const dec2 = tokens[n - 1];
  const dec1 = tokens[n - 2];
  const comma = tokens[n - 3];
  const intPart = tokens[n - 4];

  if (
    comma !== ',' ||
    !/^\d$/.test(dec2) ||
    !/^\d$/.test(dec1) ||
    !/^\d+$/.test(intPart)
  ) {
    return null;
  }

  const price = parseFloat(`${intPart}.${dec1}${dec2}`);
  // Collapse spaced name tokens into a compact string
  const name = tokens.slice(0, n - 4).join('');
  if (!name || name.length < 2) return null;

  return { name, price };
}

// ---------------------------------------------------------------------------
// Helpers shared by both parsers
// ---------------------------------------------------------------------------

const SKIP_PATTERN = /TOTAL|VENTA|VENTAJA|ACUMULADO|APAGAR/i;
const SKIP_PREFIX  = /^(CIF|TELF|NRF|SOCIO|SALDO)/i;

function shouldSkip(name: string): boolean {
  return SKIP_PATTERN.test(name) || SKIP_PREFIX.test(name);
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the text looks like the PDF spaced-character encoding.
 * We detect by finding at least one line that matches the spaced price suffix:
 * one-char tokens separated by spaces ending in "<int> , <d> <d>".
 */
function isSpacedFormat(text: string): boolean {
  return text.split('\n').some((line) => {
    const tokens = line.trim().split(' ');
    const n = tokens.length;
    if (n < 5) return false;
    return (
      tokens[n - 3] === ',' &&
      /^\d$/.test(tokens[n - 2]) &&
      /^\d$/.test(tokens[n - 1]) &&
      /^\d+$/.test(tokens[n - 4])
    );
  });
}

// ---------------------------------------------------------------------------
// Parser A — PDF spaced-character format
// ---------------------------------------------------------------------------

function extractItemsSpaced(rawText: string): ParsedTicketItem[] {
  const lines = rawText.split('\n');
  const items: ParsedTicketItem[] = [];

  for (const line of lines) {
    const parsed = parseSpacedLine(line);
    if (!parsed) continue;

    const { name, price } = parsed;
    if (shouldSkip(name)) continue;

    items.push({ name, qty: 1, unit: '', price, category: mapCategory(name) });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Parser B — OCR plain-text format (Carrefour Alameda image scan)
//
// The OCR produces plain text where the price on line N belongs to the product
// whose name appears on line N+1.  Idealised structure:
//
//   <price_A>                   ← standalone price — belongs to product A
//   <name_A>    <price_B>       ← name of A  +  price of B (OCR quirk)
//   <name_B>                    ← name of B alone (price already captured)
//   ...
//   TOTAL / VENTA line          ← footer — stop collecting
//
// Real-world Tesseract output is much noisier than the idealised case:
// the "standalone price" line often comes preceded by garbage characters
// (e.g. "EEN IARIÓN XENA ANNANRAAA 31,50"). We therefore EXTRACT every
// price (last decimal token of each line) and every plausible name in
// document order, then pair them positionally.
// ---------------------------------------------------------------------------

/** Plain-text price ANYWHERE at end of line (preceded by space, start of line, or noise). */
const TRAILING_PRICE_RE = /(\d+),(\d{2})\s*$/;

/** Detects tax-table rows (percentages) or boundary tokens that close the products section. */
const SECTION_END_RE =
  /(ART\.\s*TOTAL|TOTAL\s+A\s+PAGAR|^\s*VENTA\b|VENTAJAS|ACUMULADO|TIPO\s+BASE|^\s*TIPO\b|\bBASE\b\s+\bCUOTA\b|\d+,\d{2}\s*%|\d+\s*%)/i;

/** Header / pre-products lines we skip when identifying the section start. */
const HEADER_LINE_RE =
  /^(CIF|TELF|TEL[ÉE]FONO|NRF|SOCIO|SALDO|CENTROS|CARREFOUR|ALAMEDA)/i;

/** Reasonable price bounds for a single supermarket item. */
const MIN_ITEM_PRICE = 0.10;
const MAX_ITEM_PRICE = 999.99;

/** Strip leading non-alphanumeric noise (e.g. "+ ", "==", "*", "—") from a name. */
function cleanNamePart(raw: string): string {
  return raw
    .replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/, '')
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+$/, '')
    .trim();
}

/** Count alphanumeric chars — used to filter pure-noise lines. */
function alphanumCount(s: string): number {
  let count = 0;
  for (const ch of s) {
    if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(ch)) count++;
  }
  return count;
}

/**
 * A line looks like a plausible product name when:
 *  - it has at least 3 alphanumeric chars
 *  - it contains at least one letter
 *  - it is not a header / skip line
 *  - alphanumeric ratio > 50% (filters OCR garbage soup)
 */
function looksLikeProductName(cleaned: string): boolean {
  if (cleaned.length < 3) return false;
  if (alphanumCount(cleaned) < 3) return false;
  if (!/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(cleaned)) return false;
  if (HEADER_LINE_RE.test(cleaned)) return false;
  if (SECTION_END_RE.test(cleaned)) return false;
  if (shouldSkip(cleaned)) return false;
  const ratio = alphanumCount(cleaned) / cleaned.length;
  return ratio >= 0.5;
}

/** Parse a price from regex match — returns null if outside reasonable bounds. */
function parsePrice(intPart: string, decPart: string): number | null {
  const value = parseFloat(`${intPart}.${decPart}`);
  if (!Number.isFinite(value)) return null;
  if (value < MIN_ITEM_PRICE || value > MAX_ITEM_PRICE) return null;
  return value;
}

interface OcrLineParse {
  /** Cleaned product name candidate, or null if the line yields none. */
  name: string | null;
  /** Trailing decimal price, or null if none / out of bounds. */
  price: number | null;
}

function parseOcrLine(line: string): OcrLineParse {
  const trimmed = line.trim();
  if (!trimmed) return { name: null, price: null };

  // Pure separators
  if (/^[=*\-—_]{3,}\s*$/.test(trimmed)) return { name: null, price: null };

  const priceMatch = TRAILING_PRICE_RE.exec(trimmed);
  let price: number | null = null;
  let remainder = trimmed;

  if (priceMatch) {
    price = parsePrice(priceMatch[1], priceMatch[2]);
    remainder = trimmed.slice(0, priceMatch.index).trim();
  }

  const cleaned = cleanNamePart(remainder).toUpperCase();
  const name = cleaned && looksLikeProductName(cleaned) ? cleaned : null;
  return { name, price };
}

/**
 * Locate the product-section bounds within the OCR token list.
 *
 *  - start: first index whose line yields a PRICE (this anchors products;
 *           name-only lines before any price are noise/header).
 *  - end:   first index AT OR AFTER start whose ORIGINAL trimmed line matches
 *           SECTION_END_RE (TOTAL, VENTA, tax table, etc.).
 */
function findProductSection(
  lines: string[],
): { start: number; end: number } | null {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (HEADER_LINE_RE.test(trimmed)) continue;
    if (SECTION_END_RE.test(trimmed)) continue;
    const parsed = parseOcrLine(lines[i]);
    if (parsed.price !== null) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (SECTION_END_RE.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function extractItemsOcr(rawText: string): ParsedTicketItem[] {
  const lines = rawText.split('\n');
  const section = findProductSection(lines);
  if (!section) return [];

  // Walk the section, extracting prices and names IN DOCUMENT ORDER.
  // Each line can contribute up to one price + one name (in either combination).
  //
  // Special case for the FIRST line of the section: the Carrefour Alameda OCR
  // quirk means this line is ALWAYS a standalone price for the first product
  // (the following line carries that product's name). Any text Tesseract puts
  // before the price on this first line is hallucinated noise from blank space.
  // We therefore drop the "name" component of the first section line.
  const prices: number[] = [];
  const names: string[] = [];

  for (let i = section.start; i < section.end; i++) {
    const { name, price } = parseOcrLine(lines[i]);
    if (price !== null) prices.push(price);
    if (name !== null && i !== section.start) names.push(name);
  }

  if (prices.length === 0 || names.length === 0) return [];

  // Pair positionally: prices[k] belongs to names[k].
  // This works for the OCR quirk because the first standalone price is the
  // first price (index 0), followed by name_A (index 0). The "name + price"
  // line contributes name_A AND price_B → keeps lockstep.
  const pairCount = Math.min(prices.length, names.length);
  const items: ParsedTicketItem[] = [];
  for (let k = 0; k < pairCount; k++) {
    const name = names[k];
    const price = prices[k];
    items.push({
      name,
      qty: 1,
      unit: '',
      price,
      category: mapCategory(name),
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function extractItems(rawText: string): ParsedTicketItem[] {
  if (isSpacedFormat(rawText)) {
    return extractItemsSpaced(rawText);
  }
  return extractItemsOcr(rawText);
}

export const carrefourParser: TicketParser = {
  store: 'Carrefour',
  canParse: ({ filename, text }) => {
    const haystack = `${filename ?? ''} ${text ?? ''}`.toLowerCase();
    return haystack.includes('carrefour');
  },
  parse: async ({ text = '' }) => {
    return extractItems(text);
  },
};
