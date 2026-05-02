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
 * - € literal
 * - IVA_GROUP: single digit (tax group — ignored)
 *
 * Example: "PANELA BIO                    1,99 € 3"
 */
const ITEM_REGEX = /^(.+?)\s{2,}(\d+,\d{2})\s+[€E]\s+\d\s*$/;

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
];

function shouldSkip(line: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(line));
}

function extractItems(text: string): ParsedTicketItem[] {
  const lines = text.split('\n');
  const items: ParsedTicketItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (shouldSkip(trimmed)) continue;

    const match = ITEM_REGEX.exec(trimmed);
    if (!match) continue;

    const rawName = match[1].trim();
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
    return extractItems(text);
  },
};
