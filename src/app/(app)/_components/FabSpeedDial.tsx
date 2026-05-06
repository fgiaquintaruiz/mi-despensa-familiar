'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AddProductSheet from './AddProductSheet';

const SCAN_ICON = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="4" x2="3" y2="20" />
    <line x1="7" y1="4" x2="7" y2="20" />
    <line x1="11" y1="4" x2="11" y2="20" />
    <line x1="15" y1="4" x2="15" y2="20" />
    <line x1="19" y1="4" x2="19" y2="20" />
    <line x1="1" y1="8" x2="23" y2="8" />
    <line x1="1" y1="16" x2="23" y2="16" />
  </svg>
);

const IMPORT_ICON = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ADD_ICON = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ACTIONS = [
  {
    id: 'scan',
    label: 'Escanear código',
    icon: SCAN_ICON,
    type: 'navigate' as const,
    href: '/scanner',
  },
  {
    id: 'import',
    label: 'Importar ticket',
    icon: IMPORT_ICON,
    type: 'navigate' as const,
    href: '/import-ticket',
  },
  {
    id: 'add',
    label: 'Agregar producto',
    icon: ADD_ICON,
    type: 'sheet' as const,
  },
] satisfies { id: string; label: string; icon: React.ReactNode; type: 'navigate' | 'sheet'; href?: string }[];

export default function FabSpeedDial() {
  const router = useRouter();
  const [dialOpen, setDialOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleFabClick() {
    setDialOpen((prev) => !prev);
  }

  function handleActionClick(action: (typeof ACTIONS)[number]) {
    setDialOpen(false);
    if (action.type === 'sheet') {
      setSheetOpen(true);
    } else {
      router.push(action.href);
    }
  }

  function handleBackdropClick() {
    setDialOpen(false);
  }

  return (
    <>
      {/* Speed-dial backdrop */}
      {dialOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          aria-hidden="true"
          onClick={handleBackdropClick}
        />
      )}

      {/* Speed-dial container — fixed to viewport bottom, constrained to the 480px content column */}
      {!sheetOpen && (
      <div className="fixed bottom-0 inset-x-0 z-40 pointer-events-none mx-auto max-w-[480px]">
      <div className="pointer-events-auto absolute bottom-6 right-6 flex flex-col items-end gap-3">
        {/* Action items — rendered bottom-to-top (reversed so first action is closest to FAB) */}
        <div className="flex flex-col-reverse gap-3">
          {ACTIONS.map((action, index) => (
            <div
              key={action.id}
              className={`flex items-center gap-3 transition-all duration-200 ${
                dialOpen
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-4 opacity-0'
              }`}
              style={{
                transitionDelay: dialOpen ? `${index * 40}ms` : '0ms',
              }}
            >
              {/* Label pill */}
              <span className="whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-md">
                {action.label}
              </span>

              {/* Icon button */}
              <button
                type="button"
                aria-label={action.label}
                onClick={() => handleActionClick(action)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--color-brand)] shadow-md active:scale-95"
              >
                {action.icon}
              </button>
            </div>
          ))}
        </div>

        {/* Main FAB */}
        <button
          type="button"
          aria-label={dialOpen ? 'Cerrar menú' : 'Abrir menú de acciones'}
          aria-expanded={dialOpen}
          onClick={handleFabClick}
          className={`flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-brand)] text-2xl font-bold text-white shadow-lg transition-transform duration-200 ${
            dialOpen ? 'rotate-45' : 'rotate-0'
          }`}
        >
          +
        </button>
      </div>
      </div>
      )}

      {/* AddProductSheet — controlled mode */}
      <AddProductSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
