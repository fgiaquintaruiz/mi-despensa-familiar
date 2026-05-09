'use client';

/**
 * Minimal shadcn-compatible Dialog primitives.
 * Matches the shadcn/ui Dialog API without requiring @radix-ui/react-dialog.
 * Upgrade path: install @radix-ui/react-dialog and swap to official shadcn dialog.tsx.
 */

import { type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, children }: DialogProps) {
  if (!open) return null;
  return <>{children}</>;
}

interface DialogContentProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function DialogContent({ children, onClose, className }: DialogContentProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      aria-modal="true"
      role="dialog"
    >
      <div className={`relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ${className ?? ''}`}>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return <div className={`mb-4 ${className ?? ''}`}>{children}</div>;
}

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2 className={`text-base font-semibold text-gray-900 ${className ?? ''}`}>{children}</h2>
  );
}
