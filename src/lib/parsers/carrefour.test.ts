import { describe, it, expect } from 'vitest';
import { carrefourParser } from './carrefour';

/**
 * Sample text reproduces the exact output that pdf-parse extracts from the
 * real Carrefour ticket PDF (01/11/2025, Carrefour Alameda).
 *
 * Every character in the product lines is separated by a single space —
 * including the decimal digits of the price.  This is the raw PDF encoding.
 * Example: "C O C A C O L A Z E R O 2 L 2 , 1 0"
 *           name=COCACOLAZERO2L  price=2.10
 */
const SAMPLE_TEXT = `***Centros Comerciales Carrefour S.A***
Alameda
CIF: A28425270
Telf. Directo Tienda 675095218
Teléfono Atención al Cliente 914908900
**************************************
C O C A C O L A Z E R O 2 L 2 , 1 0
C R E M A B A Ñ O S F L O R A L 5 9 0 9 2 , 9 5
L I M P I A C R I S T A L E S 1 L 1 , 1 1
L I M P I A D O R M U L T I U S O S 1 , 9 1
M I E L C A R R E F O U R 1 K 4 , 4 5
P A T A T A S S A N T A A N A 1 , 2 5
P A S T E L M A R M O L 4 0 0 G 3 , 9 9
P L A T A N O 1 , 9 9
= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
8 A R T . T O T A L A P A G A R : 1 9 , 7 5
= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =`;

// ---------------------------------------------------------------------------
// canParse
// ---------------------------------------------------------------------------

describe('carrefourParser.canParse', () => {
  it('returns true when filename contains "carrefour"', () => {
    expect(carrefourParser.canParse({ filename: 'carrefour-nov25.pdf' })).toBe(true);
  });

  it('returns true when text contains "Carrefour"', () => {
    expect(carrefourParser.canParse({ text: 'Centros Comerciales Carrefour S.A' })).toBe(true);
  });

  it('returns false when neither filename nor text mentions carrefour', () => {
    expect(carrefourParser.canParse({ filename: 'ticket.pdf', text: 'MERCADONA, S.A.' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parse — happy path
// ---------------------------------------------------------------------------

describe('carrefourParser.parse', () => {
  it('extracts 8 product items from the sample ticket', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items).toHaveLength(8);
  });

  it('parses COCACOLAZERO2L with price 2.10', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    // Characters are collapsed: "C O C A C O L A Z E R O 2 L" → "COCACOLAZERO2L"
    const cola = items.find((i) => i.name === 'COCACOLAZERO2L');
    expect(cola).toBeDefined();
    expect(cola!.price).toBeCloseTo(2.1);
  });

  it('parses PLATANO with price 1.99', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const platano = items.find((i) => i.name === 'PLATANO');
    expect(platano).toBeDefined();
    expect(platano!.price).toBeCloseTo(1.99);
  });

  it('sets qty=1 for every item (Carrefour tickets have no qty column)', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => i.qty === 1)).toBe(true);
  });

  it('maps PLATANO to category "frescos"', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const platano = items.find((i) => i.name === 'PLATANO');
    expect(platano!.category).toBe('frescos');
  });

  it('maps LIMPIACRISTALES1L to category "limpieza"', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const cristal = items.find((i) => i.name === 'LIMPIACRISTALES1L');
    expect(cristal!.category).toBe('limpieza');
  });

  it('maps CREMABAÑOSFLORAL5909 to category "higiene"', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const crema = items.find((i) => i.name === 'CREMABAÑOSFLORAL5909');
    expect(crema!.category).toBe('higiene');
  });

  it('maps MIELCARREFOUR1K to category "despensa"', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const miel = items.find((i) => i.name === 'MIELCARREFOUR1K');
    expect(miel!.category).toBe('despensa');
  });

  // ---------------------------------------------------------------------------
  // Edge cases — lines that must be ignored
  // ---------------------------------------------------------------------------

  it('does not include the TOTAL APAGAR line as an item', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => !i.name.toUpperCase().includes('TOTAL'))).toBe(true);
    expect(items.every((i) => !i.name.toUpperCase().includes('APAGAR'))).toBe(true);
  });

  it('does not include separator lines (=== ...) as items', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => !/^[=\s]+$/.test(i.name))).toBe(true);
  });

  it('falls back to "despensa" for unrecognised product names', async () => {
    const unknownText = `***Centros Comerciales Carrefour S.A***
P R O D U C T O X Y Z 2 , 5 0
= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
1 A R T . T O T A L A P A G A R : 2 , 5 0`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: unknownText });
    const xyz = items.find((i) => i.name === 'PRODUCTOXYZ');
    expect(xyz).toBeDefined();
    expect(xyz!.category).toBe('despensa');
  });
});

// ---------------------------------------------------------------------------
// OCR plain-text format — Carrefour Alameda 02/05/2026
//
// The OCR from the JPEG ticket has a known quirk: the price printed on
// line N actually belongs to the product whose name appears on line N+1.
// Structure:
//   (blank / standalone price line)  →  price of product A
//   <name of A>   <price of B>       →  name of A  +  price of B
//   <name of B>                      →  name of B (price already captured)
// ---------------------------------------------------------------------------

const OCR_TICKET_ALAMEDA = `***Centros Comerciales Carrefour S.A***
Alameda
LLEGA
MI DÍA DE
EL CLUB
CIF: A28425270
Telf. Directo Tienda 675095218
Teléfono Atención al Cliente 914908900
*******************************
                                    31,50
ACEITE DE OLIVA                      2,99
MINI MAGDALENA
===========================================
2 ART. TOTAL A PAGAR :              34,49
===========================================

VENTAJAS OBTENIDAS:
ACUMULADO CLUB:                      0,35
TOTAL VENTAJAS EN ESTA COMPRA:       0,35

TIPO      BASE       CUOTA
4,00%    30,29       1,21
10,00%    2,72       0,27
===========================================
VENTA                               34,49`;

describe('carrefourParser.parse — OCR plain-text format (Alameda 02/05/2026)', () => {
  it('extracts exactly 2 product items', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: OCR_TICKET_ALAMEDA });
    expect(items).toHaveLength(2);
  });

  it('parses ACEITE DE OLIVA with price 31.50', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: OCR_TICKET_ALAMEDA });
    const aceite = items.find((i) => i.name === 'ACEITE DE OLIVA');
    expect(aceite).toBeDefined();
    expect(aceite!.price).toBeCloseTo(31.5);
  });

  it('parses MINI MAGDALENA with price 2.99', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: OCR_TICKET_ALAMEDA });
    const magdalena = items.find((i) => i.name === 'MINI MAGDALENA');
    expect(magdalena).toBeDefined();
    expect(magdalena!.price).toBeCloseTo(2.99);
  });

  it('maps ACEITE DE OLIVA to category "despensa"', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: OCR_TICKET_ALAMEDA });
    const aceite = items.find((i) => i.name === 'ACEITE DE OLIVA');
    expect(aceite!.category).toBe('despensa');
  });

  it('maps MINI MAGDALENA to category "despensa"', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: OCR_TICKET_ALAMEDA });
    const magdalena = items.find((i) => i.name === 'MINI MAGDALENA');
    expect(magdalena!.category).toBe('despensa');
  });

  it('does not include TOTAL, VENTA, VENTAJA, or ACUMULADO as items', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: OCR_TICKET_ALAMEDA });
    const forbidden = /TOTAL|VENTA|VENTAJA|ACUMULADO/i;
    expect(items.every((i) => !forbidden.test(i.name))).toBe(true);
  });

  it('sets qty=1 for all items', async () => {
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: OCR_TICKET_ALAMEDA });
    expect(items.every((i) => i.qty === 1)).toBe(true);
  });
});
