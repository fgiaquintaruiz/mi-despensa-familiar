import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('BarcodeScanner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the Cancelar button', () => {
    render(<BarcodeScanner onScanned={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('clicking Cancelar calls onClose', () => {
    const onClose = vi.fn();
    render(<BarcodeScanner onScanned={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the guidance text', () => {
    render(<BarcodeScanner onScanned={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('Apuntá la cámara al código de barras')).toBeInTheDocument();
  });

  it('renders the video element', () => {
    render(<BarcodeScanner onScanned={vi.fn()} onClose={vi.fn()} />);

    expect(document.querySelector('video')).toBeInTheDocument();
  });
});
