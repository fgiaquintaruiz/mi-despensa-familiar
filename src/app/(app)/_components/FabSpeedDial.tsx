'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AddProductSheet from './AddProductSheet';

const ACTIONS = [
  {
    id: 'scan',
    label: 'Escanear código',
    icon: '🔍',
    type: 'navigate' as const,
    href: '/scanner',
  },
  {
    id: 'photo',
    label: 'Foto de ticket',
    icon: '📷',
    type: 'navigate' as const,
    href: '/import-ticket?mode=photo',
  },
  {
    id: 'pdf',
    label: 'Subir PDF',
    icon: '📄',
    type: 'navigate' as const,
    href: '/import-ticket?mode=pdf',
  },
  {
    id: 'add',
    label: 'Agregar producto',
    icon: '➕',
    type: 'sheet' as const,
  },
] as const;

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

      {/* Speed-dial container */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
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
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-md active:scale-95"
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

      {/* AddProductSheet — controlled mode */}
      <AddProductSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
