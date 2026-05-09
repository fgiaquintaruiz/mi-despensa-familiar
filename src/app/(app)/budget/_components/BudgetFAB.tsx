'use client';

import { useState } from 'react';
import ManualTransactionModal from './ManualTransactionModal';

export default function BudgetFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Agregar gasto"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)] text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <ManualTransactionModal
        open={open}
        onClose={() => setOpen(false)}
        mode="create"
      />
    </>
  );
}
