import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryLabel, categoryEmoji, isLowStock } from './types';

describe('categoryLabel', () => {
  it.each(CATEGORIES.map((c) => [c.key, c.label] as const))(
    'returns label "%s" for key "%s"',
    (key, expected) => {
      expect(categoryLabel(key)).toBe(expected);
    },
  );
});

describe('categoryEmoji', () => {
  it.each(CATEGORIES.map((c) => [c.key, c.emoji] as const))(
    'returns emoji "%s" for key "%s"',
    (key, expected) => {
      expect(categoryEmoji(key)).toBe(expected);
    },
  );
});

describe('isLowStock', () => {
  it('returns true when current_stock < min_stock and min_stock > 0', () => {
    expect(isLowStock({ min_stock: 5, current_stock: 2 })).toBe(true);
  });

  it('returns false when min_stock is 0', () => {
    expect(isLowStock({ min_stock: 0, current_stock: 0 })).toBe(false);
  });

  it('returns false when current_stock equals min_stock', () => {
    expect(isLowStock({ min_stock: 3, current_stock: 3 })).toBe(false);
  });

  it('returns false when current_stock is greater than min_stock', () => {
    expect(isLowStock({ min_stock: 2, current_stock: 10 })).toBe(false);
  });
});
