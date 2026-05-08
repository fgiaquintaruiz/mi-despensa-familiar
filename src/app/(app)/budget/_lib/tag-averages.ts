import {
  SHOPPING_TRANSACTION_TAGS,
  type ShoppingTransaction,
  type ShoppingTransactionTag,
} from '@/lib/types';

export interface TagAverage {
  tag: ShoppingTransactionTag;
  average: number;
  count: number;
}

export function computeTagAverages(transactions: ShoppingTransaction[]): TagAverage[] {
  const groups = new Map<ShoppingTransactionTag, { sum: number; count: number }>();

  for (const t of transactions) {
    if (t.tag === null) continue;
    const bucket = groups.get(t.tag) ?? { sum: 0, count: 0 };
    bucket.sum += Number(t.total_amount);
    bucket.count += 1;
    groups.set(t.tag, bucket);
  }

  // Iterate over canonical order so the UI shows a stable left-to-right layout.
  return SHOPPING_TRANSACTION_TAGS.flatMap((tag) => {
    const bucket = groups.get(tag);
    if (!bucket) return [];
    return [{ tag, average: bucket.sum / bucket.count, count: bucket.count }];
  });
}
