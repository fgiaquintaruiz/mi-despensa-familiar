'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { type ReactNode } from 'react';

export const Dialog = RadixDialog.Root;

interface DialogContentProps {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function DialogContent({ children, onClose, className }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <RadixDialog.Content
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white px-4 py-6 shadow-xl ${className ?? ''}`}
      >
        {onClose && (
          <RadixDialog.Close
            aria-label="Cerrar"
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          >
            ✕
          </RadixDialog.Close>
        )}
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
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
    <RadixDialog.Title className={`text-base font-semibold text-gray-900 ${className ?? ''}`}>
      {children}
    </RadixDialog.Title>
  );
}
