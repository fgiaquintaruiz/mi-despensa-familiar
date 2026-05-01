import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mercadonaParser } from './mercadona';

const SAMPLE_TEXT = `MERCADONA, S.A.
Descripción P. Unit Importe
2 PAN H BRIOCHE 1,10 2,20
1 CEBOLLA 2 KG 3,90
1 BURGER CERDO 2,30
1 NUGGETS DE POLLO 2,70
TOTAL (€) 24,75
TARJETA BANCARIA 24,75`;

const { mockGetText } = vi.hoisted(() => ({
  mockGetText: vi.fn(),
}));

vi.mock('pdf-parse', () => {
  return {
    PDFParse: function() {
      return { getText: mockGetText };
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetText.mockResolvedValue({ text: SAMPLE_TEXT });
});

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
});

describe('mercadonaParser.parse', () => {
  it('extracts 4 items from the sample text', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    expect(items).toHaveLength(4);
  });

  it('extracts qty=2 for "PAN H BRIOCHE"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    const pan = items.find((i) => i.name === 'PAN H BRIOCHE');
    expect(pan?.qty).toBe(2);
  });

  it('extracts unit price 1.10 for PAN H BRIOCHE (first price in multi-price line)', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    const pan = items.find((i) => i.name === 'PAN H BRIOCHE');
    expect(pan?.price).toBeCloseTo(1.1);
  });

  it('extracts price 3.90 for CEBOLLA 2 KG (single-unit item)', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    const cebolla = items.find((i) => i.name === 'CEBOLLA 2 KG');
    expect(cebolla?.price).toBeCloseTo(3.9);
  });

  it('maps "CEBOLLA" to category "frescos"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    const cebolla = items.find((i) => i.name === 'CEBOLLA 2 KG');
    expect(cebolla?.category).toBe('frescos');
  });

  it('maps "NUGGETS DE POLLO" to category "frescos"', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    const nuggets = items.find((i) => i.name === 'NUGGETS DE POLLO');
    expect(nuggets?.category).toBe('frescos');
  });

  it('does not include the TOTAL line as an item', async () => {
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    expect(items.every((i) => !i.name.includes('TOTAL'))).toBe(true);
  });

  it('maps "GALLETA" to category "despensa" when present', async () => {
    const gallettaText = `MERCADONA, S.A.
Descripción P. Unit Importe
1 GALLETA RELIEVE 1,35
TOTAL (€) 1,35`;
    mockGetText.mockResolvedValueOnce({ text: gallettaText, pages: [] });
    const items = await mercadonaParser.parse({ buffer: Buffer.from('') });
    const galleta = items.find((i) => i.name === 'GALLETA RELIEVE');
    expect(galleta?.category).toBe('despensa');
  });
});
