import { describe, it, expect } from 'vitest';
import { aldiParser } from './aldi';

/**
 * Sample text reproduces a realistic Aldi ticket.
 *
 * Product line format: NAME    PRICE € IVA_GROUP
 * The trailing digit is the IVA group — NOT quantity.
 * Quantity is always 1 for all items.
 */
const SAMPLE_TEXT = `ALDI SUPERMERCADOS S.L.U.
C/ FICTICIA 12
28000 MADRID
CIF: B12345678

PANELA BIO                    1,99 € 3
LECHE ENTERA 1L               0,89 € 1
DETERGENTE ROPA 3L            4,49 € 3
GEL DUCHA 750ML               1,29 € 3
PASTA ESPIRALES 500G          0,69 € 3

OPERACION CONTACTLESS
A PAGAR                      9,35 €

IVA%   BASE IMP.   CUOTA IVA   TOTAL
 4%      0,89        0,04        0,93
10%      1,99        0,20        2,19
21%      6,47        1,36        7,83

GRACIAS POR TU COMPRA`;

// ---------------------------------------------------------------------------
// canParse
// ---------------------------------------------------------------------------

describe('aldiParser.canParse', () => {
  it('returns true when filename contains "aldi"', () => {
    expect(aldiParser.canParse({ filename: 'aldi-ticket-2025.pdf' })).toBe(true);
  });

  it('returns true when text contains "ALDI" (case-insensitive)', () => {
    expect(aldiParser.canParse({ text: 'ALDI SUPERMERCADOS S.L.U.' })).toBe(true);
  });

  it('returns false when neither filename nor text mentions aldi', () => {
    expect(aldiParser.canParse({ filename: 'ticket.pdf', text: 'MERCADONA, S.A.' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parse — happy path
// ---------------------------------------------------------------------------

describe('aldiParser.parse', () => {
  it('extracts exactly 5 product items from the sample ticket', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items).toHaveLength(5);
  });

  it('parses a simple product name and price correctly', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const panela = items.find((i) => i.name === 'Panela Bio');
    expect(panela).toBeDefined();
    expect(panela!.price).toBeCloseTo(1.99);
  });

  it('parses a multi-word product name correctly', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const leche = items.find((i) => i.name === 'Leche Entera 1L');
    expect(leche).toBeDefined();
    expect(leche!.price).toBeCloseTo(0.89);
  });

  it('sets qty=1 for every item (Aldi tickets have no qty column)', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => i.qty === 1)).toBe(true);
  });

  it('sets unit="ud" for every item', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => i.unit === 'ud')).toBe(true);
  });

  it('uses Title Case for product names', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    // Every word should start with uppercase
    for (const item of items) {
      const words = item.name.split(' ');
      for (const word of words) {
        expect(word[0]).toBe(word[0].toUpperCase());
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Category mapping
  // ---------------------------------------------------------------------------

  it('maps LECHE ENTERA to category "frescos"', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const leche = items.find((i) => i.name === 'Leche Entera 1L');
    expect(leche!.category).toBe('frescos');
  });

  it('maps DETERGENTE ROPA to category "limpieza"', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const detergente = items.find((i) => i.name === 'Detergente Ropa 3L');
    expect(detergente!.category).toBe('limpieza');
  });

  it('maps GEL DUCHA to category "higiene"', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const gel = items.find((i) => i.name === 'Gel Ducha 750Ml');
    expect(gel!.category).toBe('higiene');
  });

  it('maps PASTA ESPIRALES to category "despensa"', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const pasta = items.find((i) => i.name === 'Pasta Espirales 500G');
    expect(pasta!.category).toBe('despensa');
  });

  // ---------------------------------------------------------------------------
  // Skip rules
  // ---------------------------------------------------------------------------

  it('skips the "A PAGAR" total line', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => !i.name.toUpperCase().includes('PAGAR'))).toBe(true);
  });

  it('skips IVA table lines', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => !i.name.toUpperCase().includes('IVA'))).toBe(true);
    expect(items.every((i) => !i.name.toUpperCase().includes('BASE'))).toBe(true);
    expect(items.every((i) => !i.name.toUpperCase().includes('CUOTA'))).toBe(true);
  });

  it('skips footer lines (OPERACION CONTACTLESS, GRACIAS POR TU COMPRA)', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => !i.name.toUpperCase().includes('CONTACTLESS'))).toBe(true);
    expect(items.every((i) => !i.name.toUpperCase().includes('GRACIAS'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('falls back to "despensa" for unrecognised product names', async () => {
    const unknownText = `ALDI SUPERMERCADOS S.L.U.
PRODUCTO MISTERIOSO XYZ       2,50 € 3
A PAGAR                       2,50 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: unknownText });
    const xyz = items.find((i) => i.name === 'Producto Misterioso Xyz');
    expect(xyz).toBeDefined();
    expect(xyz!.category).toBe('despensa');
  });

  it('ignores the IVA group digit at end of line — does not treat it as quantity', async () => {
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    // All quantities must be 1, never 3 or any other IVA group digit
    expect(items.every((i) => i.qty === 1)).toBe(true);
  });
});
