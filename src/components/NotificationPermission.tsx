'use client';

import { useEffect, useState } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer.buffer as ArrayBuffer;
}

export default function NotificationPermission() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== 'granted') return;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY no está configurado');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      console.error('Error al activar notificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      // Browsers don't allow resetting Notification.permission to 'default' programmatically.
      // After unsubscribing, 'denied' is the most honest state — user must re-allow from browser settings.
      setPermission('denied');
    } catch (err) {
      console.error('Error al desactivar notificaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'unsupported') return null;

  if (permission === 'granted') {
    return (
      <button
        onClick={handleDisable}
        disabled={loading}
        title="Las notificaciones están activas. Hacé clic para desactivarlas."
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-500 hover:border-red-300 hover:text-red-500 disabled:opacity-50 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
          <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
          <path d="M18 8a6 6 0 0 0-9.33-5" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span>{loading ? 'Desactivando...' : 'Notificaciones'}</span>
      </button>
    );
  }

  if (permission === 'denied') {
    return (
      <button
        disabled
        title="Notificaciones bloqueadas. Para activarlas, habilitá los permisos en la configuración de tu navegador."
        className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-400 opacity-60 cursor-not-allowed"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
        <span>Notificaciones bloqueadas</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white disabled:opacity-50 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <span>{loading ? 'Activando...' : 'Activar notificaciones'}</span>
    </button>
  );
}
