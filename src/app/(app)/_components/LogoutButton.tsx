'use client';

import { useState } from 'react';
import { logoutAction } from '../actions';

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await logoutAction();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 min-h-[44px] min-w-[44px] rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-brand)] transition-opacity disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span>{loading ? 'Saliendo...' : 'Cerrar sesión'}</span>
    </button>
  );
}
