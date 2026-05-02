'use client';

import { useState } from 'react';
import Link from 'next/link';
import NotificationPermission from '@/components/NotificationPermission';
import LogoutButton from './LogoutButton';

export default function AppHeader() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-3xl font-extrabold text-[var(--color-brand)]">Mi Despensa</h1>

      {/* Desktop nav — all items inline, no dropdown */}
      <nav className="hidden items-center gap-2 md:flex">
        <NavLinks />
        <NotificationPermission />
        <LogoutButton />
      </nav>

      {/* Mobile hamburger button */}
      <button
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-brand)] text-[var(--color-brand)] md:hidden"
      >
        {open ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown — single menu with all items */}
      {open && (
        <div
          id="mobile-menu"
          className="absolute left-0 right-0 top-[72px] z-50 border-b border-[var(--color-brand)]/20 bg-white px-5 py-3 shadow-lg md:hidden"
        >
          <nav className="flex flex-col gap-1">
            <NavLinks onClick={() => setOpen(false)} />
            <hr className="my-1 border-[var(--color-brand)]/20" />
            <NotificationPermission />
            <LogoutButton />
          </nav>
        </div>
      )}
    </div>
  );
}

function NavLinks({ onClick }: { onClick?: () => void }) {
  const linkClass =
    'flex items-center gap-2 rounded-lg border border-[var(--color-brand)] px-3 py-2 text-sm font-semibold text-[var(--color-brand)] md:py-1.5';

  return (
    <>
      <Link href="/stats" className={linkClass} onClick={onClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        <span>Stats</span>
      </Link>
      <Link href="/shopping-list" className={linkClass} onClick={onClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span>Lista compra</span>
      </Link>
    </>
  );
}
