'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import NotificationPermission from '@/components/NotificationPermission';
import LogoutButton from './LogoutButton';

export default function AppHeader() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [profileOpen]);

  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-3xl font-extrabold text-[var(--color-brand)]">Mi Despensa</h1>

      {/* Desktop nav — hidden on mobile */}
      <nav className="hidden items-center gap-2 md:flex">
        <NavLinks />

        {/* Desktop profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            aria-label={profileOpen ? 'Cerrar perfil' : 'Abrir perfil'}
            aria-expanded={profileOpen}
            aria-controls="desktop-profile-menu"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-brand)] text-[var(--color-brand)]"
          >
            <ProfileIcon />
          </button>

          {profileOpen && (
            <div
              id="desktop-profile-menu"
              className="absolute right-0 top-full z-50 mt-1 flex flex-col gap-1 rounded-lg bg-white p-2 shadow-lg"
            >
              <NotificationPermission />
              <LogoutButton />
            </div>
          )}
        </div>
      </nav>

      {/* Mobile controls — visible on mobile only */}
      <div className="flex items-center gap-2 md:hidden">
        {/* Hamburger button — nav only */}
        <button
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-brand)] text-[var(--color-brand)]"
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

        {/* Profile button — system actions only */}
        <button
          aria-label={profileOpen ? 'Cerrar perfil' : 'Abrir perfil'}
          aria-expanded={profileOpen}
          aria-controls="mobile-profile-menu"
          onClick={() => setProfileOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-brand)] text-[var(--color-brand)]"
        >
          <ProfileIcon />
        </button>
      </div>

      {/* Mobile nav dropdown — Stats + Lista compra */}
      {open && (
        <div
          id="mobile-menu"
          className="absolute left-0 right-0 top-[72px] z-50 border-b border-[var(--color-brand)]/20 bg-white px-5 py-3 shadow-lg md:hidden"
        >
          <nav className="flex flex-col gap-1">
            <NavLinks onClick={() => setOpen(false)} />
          </nav>
        </div>
      )}

      {/* Mobile profile dropdown — NotificationPermission + Logout */}
      {profileOpen && (
        <div
          id="mobile-profile-menu"
          className="absolute right-0 top-[72px] z-50 min-w-[180px] rounded-lg border border-[var(--color-brand)]/20 bg-white px-4 py-3 shadow-lg md:hidden"
        >
          <div className="flex flex-col gap-1">
            <NotificationPermission />
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
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
