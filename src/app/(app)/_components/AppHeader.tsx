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

      {/* Desktop nav — hidden on mobile */}
      <nav className="hidden items-center gap-2 md:flex">
        <NavLinks />
        <NotificationPermission />
        <LogoutButton />
      </nav>

      {/* Hamburger button — visible on mobile only */}
      <button
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-brand)] text-[var(--color-brand)] md:hidden"
      >
        {open ? (
          /* X icon */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          /* Hamburger icon */
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Mobile dropdown menu */}
      {open && (
        <div
          id="mobile-menu"
          className="absolute left-0 right-0 top-[72px] z-50 border-b border-[var(--color-brand)]/20 bg-white px-5 py-3 shadow-lg md:hidden"
        >
          <nav className="flex flex-col gap-1">
            <NavLinks onClick={() => setOpen(false)} />
            <div className="py-1">
              <NotificationPermission />
            </div>
            <LogoutButton />
          </nav>
        </div>
      )}
    </div>
  );
}

function NavLinks({ onClick }: { onClick?: () => void }) {
  const linkClass =
    'block rounded-lg border border-[var(--color-brand)] px-3 py-2 text-sm font-semibold text-[var(--color-brand)] md:py-1.5';

  return (
    <>
      <Link href="/stats" className={linkClass} onClick={onClick}>
        Stats
      </Link>
      <Link href="/shopping-list" className={linkClass} onClick={onClick}>
        Lista compra
      </Link>
    </>
  );
}
