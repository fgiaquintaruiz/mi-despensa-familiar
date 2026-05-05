import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BarcodeScanner from './BarcodeScanner';

vi.mock('@/lib/barcode/use-barcode-scanner', () => ({
  useBarcodeScanner: vi.fn().mockReturnValue({
    videoRef: { current: null },
    isSupported: true,
    isScanning: false,
    startScan: vi.fn().mockResolvedValue(undefined),
    stopScan: vi.fn(),
  }),
}));

import { useBarcodeScanner } from '@/lib/barcode/use-barcode-scanner';

describe('BarcodeScanner', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeHooks(overrides?: { startScan?: ReturnType<typeof vi.fn> }) {
    const stopScan = vi.fn();
    const startScan = overrides?.startScan ?? vi.fn().mockResolvedValue(undefined);
    vi.mocked(useBarcodeScanner).mockReturnValue({
      videoRef: { current: null },
      isSupported: true,
      isScanning: false,
      startScan,
      stopScan,
    });
    return { startScan, stopScan };
  }

  it('renders the Cancelar button', () => {
    makeHooks();
    render(<BarcodeScanner onScanned={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('clicking Cancelar calls onClose', () => {
    const { stopScan } = makeHooks();
    const onClose = vi.fn();
    render(<BarcodeScanner onScanned={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stopScan).toHaveBeenCalled();
  });

  it('renders the guidance text', () => {
    makeHooks();
    render(<BarcodeScanner onScanned={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Apuntá la cámara al código de barras')).toBeInTheDocument();
  });

  it('renders the video element', () => {
    makeHooks();
    render(<BarcodeScanner onScanned={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector('video')).toBeInTheDocument();
  });

  it('when startScan rejects, calls stopScan and onClose', async () => {
    const { stopScan } = makeHooks({
      startScan: vi.fn().mockRejectedValue(new Error('Camera not available')),
    });
    const onClose = vi.fn();
    render(<BarcodeScanner onScanned={vi.fn()} onClose={onClose} />);
    await waitFor(() => {
      expect(stopScan).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
