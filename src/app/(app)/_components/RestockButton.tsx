'use client';

import { useTransition, useState } from 'react';
import { restockProductAction } from '../actions';

interface Props {
  productId: string;
}

export default function RestockButton({ productId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRestock = () => {
    startTransition(async () => {
      const result = await restockProductAction(productId);
      if (result.error) {
        setErrorMsg(result.error ?? 'Error desconocido');
        setTimeout(() => setErrorMsg(null), 3000);
      }
    });
  };

  return (
    <div className="relative">
      <button
        onClick={handleRestock}
        disabled={isPending}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
        aria-label="Agregar una unidad"
      >
        {isPending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        ) : (
          <span className="text-xl font-bold">+</span>
        )}
      </button>
      {errorMsg && (
        <p className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap rounded bg-red-600 px-2 py-0.5 text-xs text-white shadow">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
