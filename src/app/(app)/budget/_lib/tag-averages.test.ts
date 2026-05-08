import { describe, it, expect } from 'vitest';
import { computeTagAverages } from './tag-averages';
import type { ShoppingTransaction } from '@/lib/types';

function tx(partial: Partial<ShoppingTransaction>): ShoppingTransaction {
  return {
    id: 'tx',
    household_id: 'hh-1',
    store_name: null,
    total_amount: 0,
    item_count: 0,
    transaction_date: '2026-05-04',
    source: 'manual',
    notes: null,
    tag: null,
    created_at: '2026-05-04T00:00:00Z',
    ...partial,
  };
}

describe('computeTagAverages', () => {
  it('returns empty array when no transactions', () => {
    expect(computeTagAverages([])).toEqual([]);
  });

  it('returns empty array when all transactions have null tag', () => {
    const transactions = [
      tx({ id: '1', total_amount: 100, tag: null }),
      tx({ id: '2', total_amount: 50, tag: null }),
    ];
    expect(computeTagAverages(transactions)).toEqual([]);
  });

  it('groups one tag with one transaction', () => {
    const transactions = [tx({ id: '1', total_amount: 200, tag: 'mensual' })];
    expect(computeTagAverages(transactions)).toEqual([
      { tag: 'mensual', average: 200, count: 1 },
    ]);
  });

  it('computes average for multiple transactions of the same tag', () => {
    const transactions = [
      tx({ id: '1', total_amount: 100, tag: 'diaria' }),
      tx({ id: '2', total_amount: 20, tag: 'diaria' }),
      tx({ id: '3', total_amount: 30, tag: 'diaria' }),
    ];
    // (100 + 20 + 30) / 3 = 50
    expect(computeTagAverages(transactions)).toEqual([
      { tag: 'diaria', average: 50, count: 3 },
    ]);
  });

  it('returns one entry per tag with separate averages', () => {
    const transactions = [
      tx({ id: '1', total_amount: 300, tag: 'mensual' }),
      tx({ id: '2', total_amount: 100, tag: 'semanal' }),
      tx({ id: '3', total_amount: 50, tag: 'semanal' }),
      tx({ id: '4', total_amount: 15, tag: 'diaria' }),
    ];

    const result = computeTagAverages(transactions);
    const byTag = Object.fromEntries(result.map((r) => [r.tag, r]));

    expect(byTag.mensual).toEqual({ tag: 'mensual', average: 300, count: 1 });
    expect(byTag.semanal).toEqual({ tag: 'semanal', average: 75, count: 2 });
    expect(byTag.diaria).toEqual({ tag: 'diaria', average: 15, count: 1 });
    expect(byTag.imprevisto).toBeUndefined();
  });

  it('ignores transactions with null tag while computing averages for tagged ones', () => {
    const transactions = [
      tx({ id: '1', total_amount: 9999, tag: null }), // ignored
      tx({ id: '2', total_amount: 100, tag: 'mensual' }),
      tx({ id: '3', total_amount: 200, tag: 'mensual' }),
    ];
    expect(computeTagAverages(transactions)).toEqual([
      { tag: 'mensual', average: 150, count: 2 },
    ]);
  });

  it('returns tags in canonical order: mensual, semanal, diaria, imprevisto', () => {
    const transactions = [
      tx({ id: '1', total_amount: 5, tag: 'imprevisto' }),
      tx({ id: '2', total_amount: 5, tag: 'diaria' }),
      tx({ id: '3', total_amount: 5, tag: 'semanal' }),
      tx({ id: '4', total_amount: 5, tag: 'mensual' }),
    ];
    const tags = computeTagAverages(transactions).map((r) => r.tag);
    expect(tags).toEqual(['mensual', 'semanal', 'diaria', 'imprevisto']);
  });
});
