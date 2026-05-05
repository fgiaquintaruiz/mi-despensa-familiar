import { describe, it, expect } from 'vitest';
import { mercadonaParser } from './mercadona';

const SAMPLE_TEXT = `MERCADONA, S.A.
Descripción P. Unit Importe
2 PAN H BRIOCHE 1,10 2,20
1 CEBOLLA 2 KG 3,90
1 BURGER CERDO 2,30
1 NUGGETS DE POLLO 2,70
TOTAL (€) 24,75
TARJETA BANCARIA 24,75`;

// OCR-noisy ticket: endIdx lands on "TARJETA BANCARL", items have OCR prefixes,
// and a weight-sold item (BANANA) appears before the payment line.
// NOTE: this is a synthetic simulation where "1 BANANA" is readable. In the real
// Tesseract run (ACTUAL_OCR_TEXT below), OCR garbles "1 BANANA" to "Al" + "U E Ns".
const NOISY_OCR_TEXT = `a MERCADONA, S-*- E
Descripción — P, Unit Imp.(%)
MU MOUSSE CCO P-4 1,20
MJ 1 FIGURITAS MERLUZA 3,60
ha 1 CROQUETA CocIDO 2,00
"UE 1 EMPANADA POLLO SETAS 3,65
MAN EMPANADA ATUN 3,60
1 BANANA
0,890 ko 1,55 €/kg 1,38
TARJETA BANCARL 64`;

// ACTUAL Tesseract OCR output captured from docs/mercadona corto.jpeg.
// The BANANA line is completely garbled ("Al" + "U E Ns") and the weight line
// has an extra prefix ("E) and suffix (NU). All 6 products appear: 5 with their
// real names and 1 (BANANA) falling back to "(Producto por peso)" because the
// OCR noise is irrecoverable.
const ACTUAL_OCR_TEXT = `AU —E— A
Ae -
MU ENE
a MERCADONA, S-*- E
NU A-46103834 hn e.
Neo tras
NERO BULEVAR LOUIS PASTEUR, 17 ANNE

29010 MÁLAGA Me
29 ELEFONO: TO SES
" . 26/04/2076 19:35 0P:09 Wes
E FACTURA SIMPLIFICADA: 4492-014-479385 O
8 MELINA
nm | la
ay Descripción — P, Unit Imp.(%)
MU MOUSSE CCO P-4 1,20
MJ 1 FIGURITAS MERLUZA 3,60
ha 1 CROQUETA CocIDO 2,00
"UE 1 EMPANADA POLLO SETAS 3,65
MAN EMPANADA ATUN 3,60
Al
U E Ns
"E 0,890 ko 1,55 €/kg 1,38 NU
Uy MES 1 " Me
N NU
TARJETA BANCARL 64
1VA BASE IMPONIBLE (€) ——— CUOTA (€) "
a% 1.3 0,05 -— ¡NE
10% 1274 1,28 Ep
TOTAL 14,10 1,33 ne`;

describe('mercadonaParser.canParse', () => {
  it('returns true when filename contains "mercadona"', () => {
    expect(mercadonaParser.canParse({ filename: 'mercadona-2024.pdf' })).toBe(true);
  });

  it('returns true when text contains "MERCADONA"', () => {
    expect(mercadonaParser.canParse({ text: 'MERCADONA, S.A.' })).toBe(true);
  });

  it('returns false when neither filename nor text contains "mercadona"', () => {
    expect(mercadonaParser.canParse({ filename: 'ticket.pdf', text: 'CARREFOUR S.A.' })).toBe(false);
  });

  // Bug 1 — canParse must work even when the OCR text has noise around "MERCADONA"
  it('returns true when noisy OCR text contains "MERCADONA" (e.g. "a MERCADONA, S-*- E")', () => {
    expect(mercadonaParser.canParse({ text: NOISY_OCR_TEXT })).toBe(true);
  });
});

describe('mercadonaParser.parse', () => {
  it('extracts 4 items from the sample text', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items).toHaveLength(4);
  });

  it('extracts qty=2 for "PAN H BRIOCHE"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const pan = items.find((i) => i.name === 'PAN H BRIOCHE');
    expect(pan?.qty).toBe(2);
  });

  it('extracts unit price 1.10 for PAN H BRIOCHE (first price in multi-price line)', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const pan = items.find((i) => i.name === 'PAN H BRIOCHE');
    expect(pan?.price).toBeCloseTo(1.1);
  });

  it('extracts price 3.90 for CEBOLLA 2 KG (single-unit item)', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const cebolla = items.find((i) => i.name === 'CEBOLLA 2 KG');
    expect(cebolla?.price).toBeCloseTo(3.9);
  });

  it('maps "CEBOLLA" to category "frescos"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const cebolla = items.find((i) => i.name === 'CEBOLLA 2 KG');
    expect(cebolla?.category).toBe('frescos');
  });

  it('maps "NUGGETS DE POLLO" to category "frescos"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    const nuggets = items.find((i) => i.name === 'NUGGETS DE POLLO');
    expect(nuggets?.category).toBe('frescos');
  });

  it('does not include the TOTAL line as an item', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: SAMPLE_TEXT });
    expect(items.every((i) => !i.name.includes('TOTAL'))).toBe(true);
  });

  it('maps "GALLETA" to category "despensa" when present', async () => {
    const gallettaText = `MERCADONA, S.A.
Descripción P. Unit Importe
1 GALLETA RELIEVE 1,35
TOTAL (€) 1,35`;
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: gallettaText });
    const galleta = items.find((i) => i.name === 'GALLETA RELIEVE');
    expect(galleta?.category).toBe('despensa');
  });

  // Bug 1 — endIdx must find "TARJETA BANCARL" as section end (OCR noise, no "TOTAL (€)")
  it('returns ≥1 item when end-of-section is "TARJETA BANCARL" (no TOTAL line)', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  // Bug 2 — OCR prefix noise: "MJ 1 FIGURITAS MERLUZA 3,60" → qty=1, name="FIGURITAS MERLUZA"
  it('parses item with OCR prefix "MJ" (e.g. "MJ 1 FIGURITAS MERLUZA 3,60") with qty=1', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    const merluza = items.find((i) => i.name === 'FIGURITAS MERLUZA');
    expect(merluza).toBeDefined();
    expect(merluza?.qty).toBe(1);
    expect(merluza?.price).toBeCloseTo(3.6);
  });

  // Bug 2 — OCR prefix noise: lowercase "ha 1 CROQUETA COCIDO 2,00"
  it('parses item with lowercase OCR prefix "ha" (e.g. "ha 1 CROQUETA CocIDO 2,00")', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    const croqueta = items.find((i) => i.name.toUpperCase().includes('CROQUETA'));
    expect(croqueta).toBeDefined();
    expect(croqueta?.price).toBeCloseTo(2.0);
  });

  // Bug 3 — weight item: "1 BANANA\n0,890 ko 1,55 €/kg 1,38" → qty≈0.890, price=1.55 (unit price)
  it('parses weight-sold item: qty=kilos, price=unit price €/kg (BANANA example)', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    const banana = items.find((i) => i.name.toUpperCase().includes('BANANA'));
    expect(banana).toBeDefined();
    expect(banana?.qty).toBeCloseTo(0.89);
    expect(banana?.price).toBeCloseTo(1.55);
  });

  // Items that have NO name (pure weight lines without preceding name) must not appear
  it('does not include nameless items in the result', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    expect(items.every((i) => i.name.trim().length > 0)).toBe(true);
  });

  // Bug 1 new — garbage prevName ("U E Ns") must NOT be used as product name
  it('weight item with garbage prevName ("U E Ns") falls back to "(Producto por peso)"', async () => {
    const garbagePrevNameText = `MERCADONA, S.A.
Descripción P. Unit Importe
U E Ns
0,890 ko 1,55 €/kg 1,38
TARJETA BANCARIA 1,38`;
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: garbagePrevNameText });
    const weightItem = items.find((i) => Math.abs(i.qty - 0.89) < 0.01);
    expect(weightItem).toBeDefined();
    expect(weightItem?.name).toBe('(Producto por peso)');
  });

  // Bug 1 new — valid prevName ("1 BANANA") should be captured correctly
  it('weight item with valid prevName ("1 BANANA") uses "BANANA" as name', async () => {
    const validPrevNameText = `MERCADONA, S.A.
Descripción P. Unit Importe
1 BANANA
0,890 ko 1,55 €/kg 1,38
TARJETA BANCARIA 1,38`;
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: validPrevNameText });
    const banana = items.find((i) => i.name.toUpperCase().includes('BANANA'));
    expect(banana).toBeDefined();
    expect(banana?.name).toBe('BANANA');
    expect(banana?.qty).toBeCloseTo(0.89);
  });

  // Bug 2 new — no-qty item: "MU MOUSSE CCO P-4 1,20" → qty=1, name="MOUSSE CCO P-4"
  it('parses no-qty item "MU MOUSSE CCO P-4 1,20" with qty=1 and name="MOUSSE CCO P-4"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    const mousse = items.find((i) => i.name.toUpperCase().includes('MOUSSE'));
    expect(mousse).toBeDefined();
    expect(mousse?.qty).toBe(1);
    expect(mousse?.price).toBeCloseTo(1.2);
    expect(mousse?.name).toBe('MOUSSE CCO P-4');
  });

  // Bug 2 new — no-qty item: "MAN EMPANADA ATUN 3,60" → qty=1, name="EMPANADA ATUN"
  it('parses no-qty item "MAN EMPANADA ATUN 3,60" with qty=1 and name="EMPANADA ATUN"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    const empanada = items.find((i) => i.name.toUpperCase().includes('EMPANADA ATUN'));
    expect(empanada).toBeDefined();
    expect(empanada?.qty).toBe(1);
    expect(empanada?.price).toBeCloseTo(3.6);
  });

  // Full OCR with all items → at least 6 items parsed
  it('full NOISY_OCR_TEXT parses at least 6 items', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: NOISY_OCR_TEXT });
    expect(items.length).toBeGreaterThanOrEqual(6);
  });
});

// ─── Real Tesseract OCR from docs/mercadona corto.jpeg ───────────────────────
// The real receipt has 6 products:
//   1. MOUSSE CHOCO P-4   qty=1  price=1,20
//   2. FIGURITAS MERLUZA  qty=1  price=3,60
//   3. CROQUETA COCIDO    qty=1  price=2,00
//   4. EMPANADA POLLO SETAS qty=1 price=3,65
//   5. EMPANADA ATUN      qty=1  price=3,60
//   6. BANANA             0,890 kg × 1,55 €/kg = 1,38
//
// Tesseract garbles "1 BANANA" into "Al" + "U E Ns" (irrecoverable OCR noise), so
// item 6 falls back to "(Producto por peso)" — all other 5 products parse correctly.
// ─────────────────────────────────────────────────────────────────────────────
describe('mercadonaParser.parse — ACTUAL OCR from docs/mercadona corto.jpeg', () => {
  it('parses exactly 6 items from actual Tesseract output', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    expect(items).toHaveLength(6);
  });

  it('does not include any TOTAL/IVA/TARJETA lines as items', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const forbidden = ['TOTAL', 'IVA', 'TARJETA', 'BASE IMPONIBLE', 'CUOTA', 'MASTERCARD'];
    expect(items.every((i) => forbidden.every((f) => !i.name.toUpperCase().includes(f)))).toBe(true);
  });

  // Product 1 — "MU MOUSSE CCO P-4 1,20" (no-qty, OCR prefix "MU", CHOCO→CCO)
  it('product 1: MOUSSE CCO P-4 — qty=1, price=1.20', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const item = items.find((i) => i.name.toUpperCase().includes('MOUSSE'));
    expect(item).toBeDefined();
    expect(item?.qty).toBe(1);
    expect(item?.price).toBeCloseTo(1.2);
  });

  // Product 2 — "MJ 1 FIGURITAS MERLUZA 3,60" (OCR prefix "MJ", qty=1)
  it('product 2: FIGURITAS MERLUZA — qty=1, price=3.60', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const item = items.find((i) => i.name.toUpperCase().includes('FIGURITAS'));
    expect(item).toBeDefined();
    expect(item?.qty).toBe(1);
    expect(item?.price).toBeCloseTo(3.6);
  });

  // Product 3 — "ha 1 CROQUETA CocIDO 2,00" (lowercase OCR prefix, mixed case name)
  it('product 3: CROQUETA COCIDO — qty=1, price=2.00', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const item = items.find((i) => i.name.toUpperCase().includes('CROQUETA'));
    expect(item).toBeDefined();
    expect(item?.qty).toBe(1);
    expect(item?.price).toBeCloseTo(2.0);
  });

  // Product 4 — '"UE 1 EMPANADA POLLO SETAS 3,65' (quote+noise prefix, qty=1)
  it('product 4: EMPANADA POLLO SETAS — qty=1, price=3.65', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const item = items.find((i) => i.name.toUpperCase().includes('EMPANADA POLLO'));
    expect(item).toBeDefined();
    expect(item?.qty).toBe(1);
    expect(item?.price).toBeCloseTo(3.65);
  });

  // Product 5 — "MAN EMPANADA ATUN 3,60" (no-qty, 3-letter OCR prefix "MAN")
  it('product 5: EMPANADA ATUN — qty=1, price=3.60', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const item = items.find((i) => i.name.toUpperCase().includes('EMPANADA ATUN'));
    expect(item).toBeDefined();
    expect(item?.qty).toBe(1);
    expect(item?.price).toBeCloseTo(3.6);
  });

  // Product 6 — "1 BANANA" garbled by OCR to "Al"+"U E Ns", weight line prefix/suffix noisy.
  // Parser cannot recover "BANANA" from "Al" — falls back to "(Producto por peso)" correctly.
  it('product 6: BANANA weight item — qty≈0.890 kg, price=1.55 €/kg, name fallback to "(Producto por peso)"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const item = items.find((i) => Math.abs(i.qty - 0.89) < 0.01 && i.unit === 'kg');
    expect(item).toBeDefined();
    expect(item?.qty).toBeCloseTo(0.89);
    expect(item?.price).toBeCloseTo(1.55);
    expect(item?.unit).toBe('kg');
    // Name falls back because OCR garbles "1 BANANA" completely
    expect(item?.name).toBe('(Producto por peso)');
  });

  // Guard: OCR garbage lines like "Al", "U E Ns", "Uy MES 1 " Me", "N NU" must NOT be items
  it('OCR garbage lines (Al, U E Ns, etc.) do not become spurious items', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const garbage = ['Al', 'U E Ns', 'Uy', 'MES', 'N NU'];
    expect(items.every((i) => garbage.every((g) => i.name !== g))).toBe(true);
  });

  // Guard: EMPANADA ATUN name must NOT bleed into BANANA weight item as its name
  it('EMPANADA ATUN name does not bleed into the banana weight item', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from(''), text: ACTUAL_OCR_TEXT });
    const weightItem = items.find((i) => Math.abs(i.qty - 0.89) < 0.01 && i.unit === 'kg');
    expect(weightItem?.name).not.toContain('EMPANADA');
  });
});
