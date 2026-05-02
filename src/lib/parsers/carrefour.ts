import type { TicketParser, ParsedTicketItem } from './types';
import type { Category } from '@/lib/types';

/**
 * Carrefour ticket format: the PDF encodes every character separated by a
 * single space, e.g. "C O C A   C O L A   Z E R O   2 L   2 , 1 0".
 * Even the decimal price digits are spaced: "2 , 1 0" → 2.10.
 *
 * Parsing strategy:
 *  - Split each line into tokens by single space.
 *  - Detect a product line by the presence of 4-token price suffix: <int> , <d> <d>
 *  - The name is all tokens before the price suffix, collapsed to a single string.
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

function extractItems(rawText: string): ParsedTicketItem[] {
  const lines = rawText.split('\n');
  const items: ParsedTicketItem[] = [];

  for (const line of lines) {
    const parsed = parseSpacedLine(line);
    if (!parsed) continue;

    const { name, price } = parsed;

    // Skip totals and summary lines
    if (/TOTAL|VENTA|VENTAJA|ACUMULADO|APAGAR/i.test(name)) continue;
    // Skip header/footer lines that happen to match the pattern
    if (/^(CIF|TELF|NRF|SOCIO|SALDO)/i.test(name)) continue;

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
