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
// whose name appears on line N+1.  Concrete structure:
//
//   <price_A>                   ← standalone price — belongs to product A
//   <name_A>    <price_B>       ← name of A  +  price of B (OCR quirk)
//   <name_B>                    ← name of B alone (price already captured)
//   ...
//   TOTAL / VENTA line          ← footer — stop collecting
//
// Strategy: scan lines, find product-section boundaries, pair each price with
// the name that immediately follows (in reading order after the OCR shift).
// ---------------------------------------------------------------------------

/** Plain-text price at end of line: one-or-more digits, comma, exactly two digits. */
const PLAIN_PRICE_RE = /(\d+),(\d{2})\s*$/;

/**
 * Reject lines that look like IVA/tax table rows or other non-product numeric lines.
 * A tax-table line contains a percentage mark or multiple price-like tokens.
 */
const TAX_LINE_RE = /\d+,\d{2}%|\d+%/;

/**
 * Detects lines that are purely structural (separators, empty, header keywords).
 * Returns true → discard the line entirely.
 */
function isStructuralLine(trimmed: string): boolean {
  if (!trimmed) return true;
  if (/^[=*]{3,}/.test(trimmed)) return true;
  if (TAX_LINE_RE.test(trimmed)) return true;
  if (SKIP_PATTERN.test(trimmed)) return true;
  if (SKIP_PREFIX.test(trimmed)) return true;
  // Lines like "LLEGA", "MI DÍA DE", "EL CLUB", "Alameda", "Telf. ..." — no digits, header/promo text
  return false;
}

interface OcrToken {
  name: string | null;  // product name in UPPERCASE, or null
  price: number | null; // parsed price, or null
}

function tokenizeOcrLine(line: string): OcrToken {
  const trimmed = line.trim();
  if (isStructuralLine(trimmed)) return { name: null, price: null };

  const priceMatch = PLAIN_PRICE_RE.exec(trimmed);
  if (!priceMatch) {
    // Name-only line — check it looks like a real product name (at least one letter)
    const upper = trimmed.toUpperCase();
    const hasLetter = /[A-ZÁÉÍÓÚÑÜ]/.test(upper);
    return { name: hasLetter ? upper : null, price: null };
  }

  const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
  const namePart = trimmed.slice(0, priceMatch.index).trim();

  if (!namePart) {
    // Standalone price — no name on this line
    return { name: null, price };
  }

  // Has both name and price.  Validate the name part is product-like.
  const nameUpper = namePart.toUpperCase();
  if (!SKIP_PATTERN.test(nameUpper) && !SKIP_PREFIX.test(nameUpper) && /[A-ZÁÉÍÓÚÑÜ]/.test(nameUpper)) {
    return { name: nameUpper, price };
  }

  // Name part looks like a skip token — treat the whole line as skip
  return { name: null, price: null };
}

function extractItemsOcr(rawText: string): ParsedTicketItem[] {
  const lines = rawText.split('\n');
  const tokens = lines.map(tokenizeOcrLine);

  // Observed sequence per product pair (OCR quirk):
  //   token[i]:   { name: null,              price: P_A }  ← standalone price of product A
  //   token[i+1]: { name: NAME_A,            price: P_B }  ← name of A + price of B
  //   token[i+2]: { name: NAME_B,            price: null } ← name of B only
  //
  // Pairing rule: each price token pairs with the NEXT name token in document order,
  // provided that next name token appears AFTER the price token (positionally).
  //
  // We walk the token list. When we find a price, we scan forward for the first
  // name token that hasn't been consumed yet.

  // Index the positions of name tokens (filtering out non-product header names).
  // We identify the product section: it starts at the first standalone price line
  // (price with no name) and ends at the first TOTAL/separator line.

  // Find product section bounds
  const productSectionStart = tokens.findIndex(
    (t, i) => t.price !== null && t.name === null && i > 0,
  );
  if (productSectionStart === -1) return [];

  // Collect (index, name) and (index, price) entries WITHIN the product section
  type Indexed<T> = { idx: number; value: T };
  const priceEntries: Array<Indexed<number>> = [];
  const nameEntries: Array<Indexed<string>> = [];

  for (let i = productSectionStart; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.price !== null) priceEntries.push({ idx: i, value: tok.price });
    if (tok.name !== null)  nameEntries.push({ idx: i, value: tok.name });
  }

  // Pair each price with the first name that comes AFTER it (idx >= price.idx)
  const usedNameIndices = new Set<number>();
  const items: ParsedTicketItem[] = [];

  for (const pe of priceEntries) {
    const nameEntry = nameEntries.find(
      (ne) => ne.idx >= pe.idx && !usedNameIndices.has(ne.idx),
    );
    if (!nameEntry) continue;

    usedNameIndices.add(nameEntry.idx);
    items.push({
      name: nameEntry.value,
      qty: 1,
      unit: '',
      price: pe.value,
      category: mapCategory(nameEntry.value),
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
