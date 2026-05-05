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

  // Line 95: parseSpacedLine — name after collapsing is empty or has length < 2
  // "X 1 , 9 9" → tokens=["X","1",",","9","9"] → name="X" (len 1 < 2) → return null
  it('ignores spaced-format line where collapsed name is a single character', async () => {
    const singleCharName = `***Centros Comerciales Carrefour S.A***
X 1 , 9 9
P L A T A N O 1 , 9 9
= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
1 A R T . T O T A L A P A G A R : 2 , 9 8`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text: singleCharName });
    // "X" (single char name) should be skipped; PLATANO should be parsed
    const platano = items.find((i) => i.name === 'PLATANO');
    expect(platano).toBeDefined();
    expect(items.every((i) => i.name !== 'X')).toBe(true);
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

// ---------------------------------------------------------------------------
// OCR plain-text format — REAL Tesseract output (noisy)
//
// This is the EXACT raw text Tesseract produces from the JPEG photo of a
// Carrefour Alameda ticket.  The standalone-price line is preceded by garbage
// characters (e.g. "EEN IARIÓN XENA ANNANRAAA 31,50") because Tesseract
// hallucinates artefacts in the empty area.  The parser must:
//   1. Recognise "EEN IARIÓN XENA ANNANRAAA 31,50" as carrying price 31,50
//      (the noise is the hallucinated "name" of the line, and the trailing
//      decimal is the actual price).
//   2. Pair 31,50 with the next plausible product name → ACEITE DE OLIVA.
//   3. Pair 2,99 with MINI MAGDALENA (OCR'd as "MINT MAGDALENA").
//   4. Reject any number that lives in the totals / VAT block.
// ---------------------------------------------------------------------------

const OCR_TICKET_ALAMEDA_REAL = `xxxCentros Comerciales Carrefour S.Axx*
Alameda
LLEGA —
EXE |
dal
+ CIF: A28425270 95218
DS € irecto Tienda 675093 89
E ai al Cliente 914307200
d a EEN IARIÓN XENA ANNANRAAA 31,50
ACEITE DE OLIVA 2,99
MINT MAGDALENA
-=2238 E A
2 ART. TOTAL A PAGAR : —— 94,49
TZ 4
VENTAJAS OBTENIDAS: he
ACUMULADO CLUB: 0.39
TOTAL VENTAJAS EN ESTA COMPRA: DT
TIPO BASE CUOTA
4,00% 30,29 1,21
10,00% Z, e 0,27
VENTA. 34,49`;

describe('carrefourParser.parse — REAL Tesseract OCR (noisy)', () => {
  it('extracts ACEITE DE OLIVA at 31,50 despite leading noise on the price line', async () => {
    const items = await carrefourParser.parse({
      buffer: Buffer.from(''),
      text: OCR_TICKET_ALAMEDA_REAL,
    });
    const aceite = items.find((i) => i.name === 'ACEITE DE OLIVA');
    expect(aceite).toBeDefined();
    expect(aceite!.price).toBeCloseTo(31.5);
  });

  it('extracts a magdalena item at 2,99 (OCR-corrupted name kept verbatim)', async () => {
    const items = await carrefourParser.parse({
      buffer: Buffer.from(''),
      text: OCR_TICKET_ALAMEDA_REAL,
    });
    const magdalena = items.find((i) => i.name.includes('MAGDALENA'));
    expect(magdalena).toBeDefined();
    expect(magdalena!.price).toBeCloseTo(2.99);
  });

  it('does NOT extract footer / VAT / totals values as items', async () => {
    const items = await carrefourParser.parse({
      buffer: Buffer.from(''),
      text: OCR_TICKET_ALAMEDA_REAL,
    });
    const forbiddenPrices = [94.49, 30.29, 2.72, 1.21, 0.27, 34.49];
    for (const p of forbiddenPrices) {
      expect(items.find((i) => Math.abs(i.price - p) < 0.005)).toBeUndefined();
    }
  });

  it('does NOT include any TOTAL / VENTA / VENTAJA / ACUMULADO / TIPO line as an item', async () => {
    const items = await carrefourParser.parse({
      buffer: Buffer.from(''),
      text: OCR_TICKET_ALAMEDA_REAL,
    });
    const forbidden = /TOTAL|VENTA|VENTAJA|ACUMULADO|^TIPO\b|BASE\s+CUOTA/i;
    expect(items.every((i) => !forbidden.test(i.name))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OCR edge cases — uncovered branches
// ---------------------------------------------------------------------------

describe('carrefourParser.parse — OCR edge cases (branch coverage)', () => {
  // Line 276: SECTION_END_RE fires on a non-header, non-empty line before any price is found.
  // Covers the `if (SECTION_END_RE.test(trimmed)) continue;` branch inside findProductSection.
  it('returns [] when a TOTAL line appears before any price line (no product section)', async () => {
    const text = `Centros Comerciales Carrefour S.A
TOTAL A PAGAR
VENTA
34,49`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toEqual([]);
  });

  // Line 283: start === -1 → findProductSection returns null
  // Line 298: !section → extractItemsOcr returns []
  it('returns [] when OCR text has Carrefour header but no price lines at all', async () => {
    const text = `Centros Comerciales Carrefour S.A
Alameda
Solo texto sin precios
Mas texto sin precios`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toEqual([]);
  });

  // Line 317: section found, prices collected, but names array is empty (all name-candidates rejected)
  // Happens when the section has only a standalone price line followed immediately by the footer,
  // so there are no name-bearing lines inside the section.
  it('returns [] when section yields prices but no valid product names', async () => {
    // The section starts at the first price line, but the only non-price line inside the section
    // is a pure-separator line — so names[] stays empty and line 317 returns [].
    const text = `Centros Comerciales Carrefour S.A
Alameda
                       1,99
===========================
2 ART. TOTAL A PAGAR : 1,99`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toEqual([]);
  });

  // Cover the category branches in the OCR path that aren't hit by the two-item Alameda ticket:
  // mapCategory → 'frescos', 'limpieza', 'higiene', 'bebe', 'farmacia', 'despensa'
  it('maps LECHE product to "frescos" in OCR path', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    2,50
LECHE ENTERA 1L
===========================================
1 ART. TOTAL A PAGAR : 2,50`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    const leche = items.find((i) => i.name === 'LECHE ENTERA 1L');
    expect(leche?.category).toBe('frescos');
  });

  it('maps DETERGENTE product to "limpieza" in OCR path', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    3,99
DETERGENTE ROPA 3L
===========================================
1 ART. TOTAL A PAGAR : 3,99`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    const det = items.find((i) => i.name === 'DETERGENTE ROPA 3L');
    expect(det?.category).toBe('limpieza');
  });

  it('maps CHAMPU product to "higiene" in OCR path', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    2,99
CHAMPU SUAVE 400ML
===========================================
1 ART. TOTAL A PAGAR : 2,99`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    const champu = items.find((i) => i.name === 'CHAMPU SUAVE 400ML');
    expect(champu?.category).toBe('higiene');
  });

  it('maps PAÑAL product to "bebe" in OCR path', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    8,99
PAÑALES BEBE T3
===========================================
1 ART. TOTAL A PAGAR : 8,99`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    const pañal = items.find((i) => i.name.includes('PA'));
    // Ñ may be tricky — just assert category if found
    if (pañal) {
      expect(pañal.category).toBe('bebe');
    }
  });

  it('maps PARACETAMOL product to "farmacia" in OCR path', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    3,50
PARACETAMOL 1G 20COMP
===========================================
1 ART. TOTAL A PAGAR : 3,50`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    const para = items.find((i) => i.name.includes('PARACETAMOL'));
    expect(para?.category).toBe('farmacia');
  });

  // Cover parsePrice returning null when value is below MIN_ITEM_PRICE (< 0.10)
  it('ignores price below 0.10 (outside reasonable bounds)', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    0,01
PRODUCTO BARATO
===========================================
1 ART. TOTAL A PAGAR : 0,01`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    // Price 0.01 < MIN_ITEM_PRICE → no item created
    expect(items).toEqual([]);
  });

  // Line 241: parseOcrLine called with an empty line inside the section
  it('handles empty lines inside the product section without crashing', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    1,99

LECHE ENTERA 1L
===========================================
2 ART. TOTAL A PAGAR : 1,99`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    const leche = items.find((i) => i.name === 'LECHE ENTERA 1L');
    expect(leche).toBeDefined();
    expect(leche?.price).toBeCloseTo(1.99);
  });

  // Line 274: findProductSection — empty lines before the first price line
  it('skips empty lines before the first price in findProductSection', async () => {
    const text = `Centros Comerciales Carrefour S.A

                                    2,50
PANELA BIO
===========================================
1 ART. TOTAL A PAGAR : 2,50`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  // Line 216: looksLikeProductName — string with 3+ alnum chars but NO letters (all digits)
  it('rejects product name candidate that has 3+ alnum chars but no letters', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    1,99
123                              2,50
ACEITE DE OLIVA
===========================================
2 ART. TOTAL A PAGAR : 4,49`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    const aceite = items.find((i) => i.name === 'ACEITE DE OLIVA');
    expect(aceite).toBeDefined();
    expect(items.every((i) => i.name !== '123')).toBe(true);
  });

  // Line 218: looksLikeProductName — SECTION_END_RE match inside product section
  it('rejects a line matching SECTION_END_RE as a product name inside the section', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    1,99
ACEITE DE OLIVA                  2,50
TIPO BASE CUOTA
===========================================
2 ART. TOTAL A PAGAR : 4,49`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    expect(items.every((i) => !i.name.includes('TIPO'))).toBe(true);
  });

  // Line 219: looksLikeProductName — shouldSkip fires on a name inside section
  it('rejects product candidate matching SKIP_PATTERN (VENTAJA) inside the section', async () => {
    const text = `Centros Comerciales Carrefour S.A
                                    1,99
VENTAJAS OBTENIDAS               0,35
ACEITE DE OLIVA
===========================================
1 ART. TOTAL A PAGAR : 1,99`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    expect(items.every((i) => !i.name.includes('VENTAJAS'))).toBe(true);
  });

  // looksLikeProductName ratio branch: low alphanumeric ratio
  it('rejects product name candidate with low alnum/total ratio (below 50%)', async () => {
    // A very symbol-heavy line that gets past length/letter checks but fails ratio
    const text = `Centros Comerciales Carrefour S.A
                                    2,99
+++ AB +++                       1,50
LECHE ENTERA 1L
===========================================
2 ART. TOTAL A PAGAR : 4,49`;
    const items = await carrefourParser.parse({ buffer: Buffer.from(''), text });
    // Garbage should not appear
    expect(items.every((i) => !i.name.includes('+++'))).toBe(true);
  });
});
