import type { TicketParser, ParsedTicketItem } from './types';
import type { Category } from '@/lib/types';

const CATEGORY_KEYWORDS: Array<[string[], Category]> = [
  [
    [
      'LECHE', 'YOGUR', 'NATA', 'QUESO', 'MANTEQUILLA', 'HUEVO', 'CARNE', 'POLLO',
      'BURGER', 'PIZZA', 'NUGGETS', 'JAMON', 'CHORIZO', 'SALMON', 'ATUN',
      'VERDURA', 'FRUTA', 'ESPINACA', 'CEBOLLA', 'TOMATE', 'LECHUGA', 'ZANAHORIA', 'PATATA',
    ],
    'frescos',
  ],
  [
    [
      'PAN', 'GALLETA', 'PASTA', 'ARROZ', 'CONSERVA', 'ACEITE', 'MASA', 'HARINA',
      'AZUCAR', 'SAL', 'CAFE', 'COLA', 'REFRESCO', 'AGUA', 'ZUMO', 'BRIOCHE', 'EMPANADA',
    ],
    'despensa',
  ],
  [['LIMPIA', 'DETERGENTE', 'SUAVIZANTE', 'FREGASUELOS', 'BAYETA'], 'limpieza'],
  [['CHAMPU', 'GEL', 'JABON', 'COLONIA', 'CREMA', 'DENTO', 'HIGIENE'], 'higiene'],
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

const ITEM_REGEX = /^(\d+)\s+(.+?)\s+(\d+,\d{2})(?:\s+(\d+,\d{2}))?$/;

function parseEuro(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

function extractItems(text: string): ParsedTicketItem[] {
  const lines = text.split('\n');

  const startIdx = lines.findIndex((l) => l.includes('Descripción'));
  const endIdx = lines.findIndex((l) => l.includes('TOTAL (€)'));

  if (startIdx === -1 || endIdx === -1) return [];

  const items: ParsedTicketItem[] = [];
  for (const line of lines.slice(startIdx + 1, endIdx)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = ITEM_REGEX.exec(trimmed);
    if (!match) continue;

    items.push({
      name: match[2].trim(),
      qty: parseInt(match[1], 10),
      unit: '',
      price: parseEuro(match[3]),
      category: mapCategory(match[2].trim()),
    });
  }

  return items;
}

export const mercadonaParser: TicketParser = {
  store: 'Mercadona',
  canParse: ({ filename, text }) => {
    const haystack = `${filename ?? ''} ${text ?? ''}`.toLowerCase();
    return haystack.includes('mercadona');
  },
  parse: async ({ text = '' }) => {
    return extractItems(text);
  },
};
