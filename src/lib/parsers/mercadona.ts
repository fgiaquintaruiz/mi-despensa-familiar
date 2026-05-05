import type { TicketParser, ParsedTicketItem } from './types';
import type { Category } from '@/lib/types';

const CATEGORY_KEYWORDS: Array<[string[], Category]> = [
  [
    [
      'LECHE', 'YOGUR', 'NATA', 'QUESO', 'MANTEQUILLA', 'HUEVO', 'CARNE', 'POLLO',
      'BURGER', 'PIZZA', 'NUGGETS', 'JAMON', 'CHORIZO', 'SALMON', 'ATUN',
      'VERDURA', 'FRUTA', 'ESPINACA', 'CEBOLLA', 'TOMATE', 'LECHUGA', 'ZANAHORIA', 'PATATA', 'BANANA',
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

// Bug 2 fix: tolerate up to 4 non-digit OCR prefix chars (e.g. "MJ ", "ha ")
const ITEM_REGEX = /^(?:[^0-9]{0,4})?(\d+)\s+(.+?)\s+(\d+,\d{2})(?:\s+(\d+,\d{2}))?$/;

// Bug 3 fix: weight-sold items — format: "[noise] KILOS ko|kg UNIT_PRICE €/kg TOTAL_PRICE"
const WEIGHT_ITEM_REGEX = /^(?:[^0-9]{0,4})?(\d+[,.]\d+)\s+k[og]?\s+(\d+[,.]\d+)\s+[€E]\/kg/i;

function parseEuro(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

function extractItems(text: string): ParsedTicketItem[] {
  const lines = text.split('\n');

  const startIdx = lines.findIndex((l) => l.includes('Descripción'));
  // Bug 1 fix: OCR may produce "TARJETA BANCARL" instead of "TOTAL (€)"
  const endIdx = lines.findIndex((l) =>
    /TOTAL\s*\(?€?\)?/i.test(l) || /TARJETA|EFECTIVO|CAMBIO/i.test(l)
  );

  if (startIdx === -1 || endIdx === -1) return [];

  const items: ParsedTicketItem[] = [];
  let prevName: string | null = null;

  for (const line of lines.slice(startIdx + 1, endIdx)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Bug 3: try weight-item pattern first
    const weightMatch = WEIGHT_ITEM_REGEX.exec(trimmed);
    if (weightMatch) {
      // qty = kilos (replace comma with dot), price = unit price (€/kg)
      const qty = parseFloat(weightMatch[1].replace(',', '.'));
      const price = parseEuro(weightMatch[2]);
      // name comes from the previous line (the product name line, e.g. "1 BANANA")
      const name = prevName ?? '';
      if (name) {
        items.push({ name, qty, unit: 'kg', price, category: mapCategory(name) });
      }
      prevName = null;
      continue;
    }

    const match = ITEM_REGEX.exec(trimmed);
    if (!match) {
      // Could be a name-only line preceding a weight line (e.g. "1 BANANA" with no price).
      // Capture it as prevName so the weight line below can claim it.
      // A name-only line looks like: optional qty + words, no price at the end.
      const nameOnlyMatch = /^(?:[^0-9]{0,4})?(?:\d+\s+)?([A-Za-záéíóúüñÁÉÍÓÚÜÑ][A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ\s\-]+)$/.exec(trimmed);
      prevName = nameOnlyMatch ? nameOnlyMatch[1].trim() : null;
      continue;
    }

    const name = match[2].trim();
    items.push({
      name,
      qty: parseInt(match[1], 10),
      unit: '',
      price: parseEuro(match[3]),
      category: mapCategory(name),
    });
    // Store name so a following weight line can claim it
    prevName = name;
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
