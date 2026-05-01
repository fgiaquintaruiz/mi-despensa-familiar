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
      className="min-h-[44px] min-w-[44px] rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-brand)] transition-opacity disabled:opacity-50"
    >
      {loading ? 'Saliendo...' : 'Cerrar sesión'}
    </button>
  );
}
