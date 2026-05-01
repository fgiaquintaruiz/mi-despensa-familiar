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

  if (permission === 'unsupported') return null;

  if (permission === 'granted') {
    return (
      <span className="text-xs text-green-600 font-medium">
        Notificaciones activas
      </span>
    );
  }

  if (permission === 'denied') {
    return (
      <span className="text-xs text-red-500 font-medium">
        Notificaciones bloqueadas (activar en config del browser)
      </span>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={loading}
      className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-[var(--color-brand)] disabled:opacity-50"
    >
      {loading ? 'Activando...' : 'Activar notificaciones'}
    </button>
  );
}
