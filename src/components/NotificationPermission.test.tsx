import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationPermission from './NotificationPermission';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setNotificationPermission(
  permission: NotificationPermission,
  requestPermission = vi.fn().mockResolvedValue('granted'),
) {
  Object.defineProperty(window, 'Notification', {
    value: { permission, requestPermission },
    writable: true,
    configurable: true,
  });
  return requestPermission;
}

function setServiceWorker(overrides?: Partial<{ getSubscription: ReturnType<typeof vi.fn> }>) {
  const getSubscription = overrides?.getSubscription ?? vi.fn().mockResolvedValue(null);
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription,
          subscribe: vi.fn().mockResolvedValue({
            toJSON: () => ({ endpoint: 'https://example.com/push' }),
          }),
        },
      }),
    },
    writable: true,
    configurable: true,
  });
  return { getSubscription };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('NotificationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    // Restore serviceWorker support by default
    setServiceWorker();
    // Restore Notification support by default
    setNotificationPermission('default');
  });

  // -------------------------------------------------------------------------
  // 1. Unsupported — component returns null
  // -------------------------------------------------------------------------
  it('renders nothing when Notification API is not available', async () => {
    // `'Notification' in window` is the actual guard in the component.
    // Setting the value to undefined leaves the key present, so we must
    // delete the property entirely to make the `in` check return false.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).Notification;

    const { container } = render(<NotificationPermission />);

    // Wait for the useEffect to run and set state to 'unsupported'
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Default state — "Activar notificaciones" button is enabled
  // -------------------------------------------------------------------------
  it('shows enabled "Activar notificaciones" button when permission is default', async () => {
    setNotificationPermission('default');
    render(<NotificationPermission />);

    const button = await screen.findByRole('button', { name: /activar notificaciones/i });

    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 3. Granted state — "Notificaciones activas" button triggers unsubscribe
  // -------------------------------------------------------------------------
  it('shows "Notificaciones activas" button and calls unsubscribe flow on click', async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(true);
    const mockGetSubscription = vi.fn().mockResolvedValue({
      unsubscribe: mockUnsubscribe,
      endpoint: 'https://example.com/push',
    });
    setNotificationPermission('granted');
    setServiceWorker({ getSubscription: mockGetSubscription });

    render(<NotificationPermission />);

    const button = await screen.findByRole('button', { name: /notificaciones activas/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGetSubscription).toHaveBeenCalled();
      expect(mockUnsubscribe).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/push/subscribe',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. Denied state — disabled "Notificaciones bloqueadas" button
  // -------------------------------------------------------------------------
  it('shows disabled "Notificaciones bloqueadas" button when permission is denied', async () => {
    setNotificationPermission('denied');
    render(<NotificationPermission />);

    const button = await screen.findByRole('button', { name: /notificaciones bloqueadas/i });

    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 5. Click "Activar" — calls Notification.requestPermission()
  // -------------------------------------------------------------------------
  it('calls Notification.requestPermission() when "Activar notificaciones" is clicked', async () => {
    // requestPermission stays pending so we can observe the call without racing
    const mockRequestPermission = vi.fn().mockReturnValue(new Promise(() => {}));
    setNotificationPermission('default', mockRequestPermission);

    render(<NotificationPermission />);

    const button = await screen.findByRole('button', { name: /activar notificaciones/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 6. requestPermission resolves 'granted' — state updates to granted
  // -------------------------------------------------------------------------
  it('updates UI to granted state after requestPermission resolves granted', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    setNotificationPermission('default', mockRequestPermission);
    setServiceWorker();

    // Provide VAPID key so the subscribe path runs without early-returning
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'dGVzdA=='); // base64 "test"

    render(<NotificationPermission />);

    const activarButton = await screen.findByRole('button', { name: /activar notificaciones/i });
    fireEvent.click(activarButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /notificaciones activas/i })).toBeInTheDocument();
    });

    vi.unstubAllEnvs();
  });
});
