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

  // ---------------------------------------------------------------------------
  // OCR-noisy input (Tesseract artifacts)
  // ---------------------------------------------------------------------------

  it('parses correctly when Tesseract uses decimal points instead of commas', async () => {
    const noisyText = `ALDI SUPERMERCADOS S.L.U.

PANELA BIO                    1.99 € 3
LECHE ENTERA 1L               0.89 € 1

A PAGAR                       2.88 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: noisyText });
    expect(items).toHaveLength(2);
    const panela = items.find((i) => i.name === 'Panela Bio');
    expect(panela).toBeDefined();
    expect(panela!.price).toBeCloseTo(1.99);
    const leche = items.find((i) => i.name === 'Leche Entera 1L');
    expect(leche).toBeDefined();
    expect(leche!.price).toBeCloseTo(0.89);
  });

  it('parses correctly when the IVA group digit is missing (OCR dropout)', async () => {
    const noisyText = `ALDI SUPERMERCADOS S.L.U.

PASTA ESPIRALES 500G          0,69 €
DETERGENTE ROPA 3L            4,49 €

A PAGAR                       5,18 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: noisyText });
    expect(items).toHaveLength(2);
    const pasta = items.find((i) => i.name === 'Pasta Espirales 500G');
    expect(pasta).toBeDefined();
    expect(pasta!.price).toBeCloseTo(0.69);
    const detergente = items.find((i) => i.name === 'Detergente Ropa 3L');
    expect(detergente).toBeDefined();
    expect(detergente!.price).toBeCloseTo(4.49);
  });

  it('parses heavily garbled OCR lines (leading/trailing noise, single space before price, missing €)', async () => {
    // Real-world Tesseract output for an Aldi ticket photo:
    //   "a PANELA BÍO d 1,99 € 3 : ha"  — leading "a ", trailing " d", noise after IVA group
    //   "a. A PAR 1,94 o"               — leading "a. ", no € symbol, trailing " o"
    const garbledText = `ALDI dos Hermanas Supermercados, S,L.U
aldi.es

a PANELA BÍO d 1,99 € 3 : ha
a. A PAR 1,94 o

A PAGAR                       3,93 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: garbledText });
    expect(items).toHaveLength(1);

    const panela = items.find((i) => i.name.toUpperCase().includes('PANELA'));
    expect(panela).toBeDefined();
    expect(panela!.price).toBeCloseTo(1.99);
  });

  // ---------------------------------------------------------------------------
  // Name validation — looksLikeProductName guards
  // ---------------------------------------------------------------------------

  it('rejects single-char name "A."', async () => {
    // After cleanOcrName "A." has only 1 alnum character — must be discarded
    const text = `ALDI SUPERMERCADOS S.L.U.
A.                            0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  it('rejects all-single-char tokens "A B"', async () => {
    // All tokens are length 1 — must be discarded
    const text = `ALDI SUPERMERCADOS S.L.U.
A B                           0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  it('rejects pure number "3"', async () => {
    // Pure numeric name must be discarded
    const text = `ALDI SUPERMERCADOS S.L.U.
3                             0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  it('keeps valid short name "Leche"', async () => {
    // 5-char single-token name must be accepted
    const text = `ALDI SUPERMERCADOS S.L.U.
LECHE                         0,89 € 1
A PAGAR                       0,89 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Leche');
  });

  it('rejects "A Par" — no token has length >= 4', async () => {
    // cleanOcrName strips leading "A " → "PAR" (len 3) — no token >= 4 chars, must be discarded
    const text = `ALDI SUPERMERCADOS S.L.U.
A PAR                         1,94 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       3,93 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  it('does NOT match IVA percentage table data rows in lenient mode', async () => {
    // Rows like " 4%   0,89   0,04   0,93" must still be skipped even with lenient regex
    const textWithIvaTable = `ALDI SUPERMERCADOS S.L.U.

PANELA BIO                    1,99 € 3

IVA%   BASE IMP.   CUOTA IVA   TOTAL
 4%      0,89        0,04        0,93
10%      1,99        0,20        2,19

A PAGAR                       2,88 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text: textWithIvaTable });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  // ---------------------------------------------------------------------------
  // cleanOcrName — fallback branch (line 146): cleaning empties the string
  // ---------------------------------------------------------------------------

  it('cleanOcrName fallback: name consisting only of a single leading letter falls back to original', async () => {
    // "a." → leading-char removal strips everything → cleaned is empty → fallback to original name "a."
    // The resulting raw name "a." has <3 alnum chars so looksLikeProductName rejects it.
    // We just need to exercise the fallback path without crashing.
    const text = `ALDI SUPERMERCADOS S.L.U.
a.                            0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    // "a." is rejected by looksLikeProductName — only PANELA BIO survives
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  it('cleanOcrName: single trailing letter is stripped and original name is used when result is empty', async () => {
    // A name like "z" only — after stripping trailing single char "" is returned and fallback kicks in.
    const text = `ALDI SUPERMERCADOS S.L.U.
z                             0,50 € 3
LECHE ENTERA 1L               0,89 € 1
A PAGAR                       1,39 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    // "z" has only 1 alnum char, rejected by looksLikeProductName
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Leche Entera 1L');
  });

  // ---------------------------------------------------------------------------
  // looksLikeProductName — rule 1: alnumCount < 3 (line 163)
  // ---------------------------------------------------------------------------

  it('looksLikeProductName rule 1: two-char name "AB" is rejected (alnumCount < 3)', async () => {
    const text = `ALDI SUPERMERCADOS S.L.U.
AB                            0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  // ---------------------------------------------------------------------------
  // looksLikeProductName — rule 2: pure number (line 166)
  // Already covered by "rejects pure number 3" test but adding a multi-digit case
  // ---------------------------------------------------------------------------

  it('looksLikeProductName rule 2: pure 3-digit number "123" is rejected (passes rule 1, fails rule 2)', async () => {
    // "123" has 3 alnum chars (passes rule 1) but is a pure number (rule 2 rejects)
    const text = `ALDI SUPERMERCADOS S.L.U.
123                           0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  // ---------------------------------------------------------------------------
  // looksLikeProductName — rule 3: all tokens single char (line 170)
  // ---------------------------------------------------------------------------

  it('looksLikeProductName rule 3: "A B C" (all single-char tokens) is rejected', async () => {
    const text = `ALDI SUPERMERCADOS S.L.U.
A B C                         0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });

  // ---------------------------------------------------------------------------
  // looksLikeProductName — rule 4: no token >= 4 chars (line 173)
  // ---------------------------------------------------------------------------

  it('looksLikeProductName rule 4: "Par Del" (no token >= 4 chars) is rejected', async () => {
    // Both tokens have 3 chars → rule 4 fires
    const text = `ALDI SUPERMERCADOS S.L.U.
Par Del                       0,50 € 3
PANELA BIO                    1,99 € 3
A PAGAR                       2,49 €`;
    const items = await aldiParser.parse({ buffer: Buffer.from(''), text });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Panela Bio');
  });
});
