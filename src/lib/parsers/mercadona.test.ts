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
});
