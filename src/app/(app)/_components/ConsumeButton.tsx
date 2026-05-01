'use client';

import { useTransition } from 'react';
import { consumeProductAction } from '../actions';

interface Props {
  productId: string;
  currentStock: number;
}

export default function ConsumeButton({ productId, currentStock }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleConsume = () => {
    if (currentStock <= 0) return;

    startTransition(async () => {
      const result = await consumeProductAction(productId);
      if (result.error) {
        alert(result.error);
      }
    });
  };

  return (
    <button
      onClick={handleConsume}
      disabled={isPending || currentStock <= 0}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
      aria-label="Consumir una unidad"
    >
      {isPending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      ) : (
        <span className="text-xl font-bold">−</span>
      )}
    </button>
  );
}
