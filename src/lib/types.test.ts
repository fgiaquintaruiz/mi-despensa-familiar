import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryLabel, categoryEmoji } from './types';

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
