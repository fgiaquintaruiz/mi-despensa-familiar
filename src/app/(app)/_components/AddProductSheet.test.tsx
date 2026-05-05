import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import AddProductSheet from './AddProductSheet';
import { CATEGORIES, categoryLabel } from '@/lib/types';
import type { Category } from '@/lib/types';

const mockUseBarcodeScanner = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    videoRef: { current: null },
    isSupported: false,
    isScanning: false,
    startScan: vi.fn().mockResolvedValue(undefined),
    stopScan: vi.fn(),
  }),
);

const mockAddProductAction = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock('../actions', () => ({
  addProductAction: mockAddProductAction,
}));

const mockRouterRefresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

const mockUseActionState = vi.hoisted(() =>
  vi.fn().mockImplementation((action: unknown, initialState: unknown) => [initialState, action, false]),
);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: mockUseActionState,
  };
});

const mockLookupBarcode = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock('@/lib/barcode/open-food-facts', () => ({
  lookupBarcode: mockLookupBarcode,
}));

vi.mock('@/lib/barcode/use-barcode-scanner', () => ({
  useBarcodeScanner: mockUseBarcodeScanner,
}));

const mockBarcodeScanner = vi.hoisted(() => vi.fn().mockReturnValue(null));

vi.mock('./BarcodeScanner', () => ({
  default: mockBarcodeScanner,
}));

describe('AddProductSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActionState.mockImplementation(
      (action: unknown, initialState: unknown) => [initialState, action, false],
    );
    mockUseBarcodeScanner.mockReturnValue({
      videoRef: { current: null },
      isSupported: false,
      isScanning: false,
      startScan: vi.fn().mockResolvedValue(undefined),
      stopScan: vi.fn(),
    });
  });

  it('renders the FAB with "+" label', () => {
    render(<AddProductSheet />);
    expect(screen.getByRole('button', { name: /agregar producto/i })).toBeInTheDocument();
  });

  it('sheet is hidden by default', () => {
    render(<AddProductSheet />);
    expect(screen.queryByRole('textbox', { name: /nombre/i })).not.toBeInTheDocument();
  });

  it('clicking the FAB opens the sheet and shows the form', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    expect(screen.getByRole('textbox', { name: /nombre/i })).toBeInTheDocument();
  });

  it('sheet renders all 6 category chips with correct labels', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    for (const cat of CATEGORIES) {
      expect(screen.getByText(categoryLabel(cat.key as Category))).toBeInTheDocument();
    }
  });

  it('clicking a category chip selects it', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    const chip = screen.getByText(categoryLabel('despensa'));
    fireEvent.click(chip);
    expect(chip.closest('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a second category chip deselects the first', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    const chip1 = screen.getByText(categoryLabel('despensa'));
    const chip2 = screen.getByText(categoryLabel('higiene'));
    fireEvent.click(chip1);
    fireEvent.click(chip2);
    expect(chip1.closest('button')).toHaveAttribute('aria-pressed', 'false');
    expect(chip2.closest('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('counter starts at 1', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('1');
  });

  it('clicking "+" on counter increments to 2', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Incrementar cantidad' }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('2');
  });

  it('clicking "−" on counter decrements from 2 to 1', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Incrementar cantidad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrementar cantidad' }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('1');
  });

  it('counter does not go below 1', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrementar cantidad' }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('1');
  });

  it('Guardar button is disabled when name is empty', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('Guardar button is disabled when category is not selected', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /nombre/i }), { target: { value: 'Leche' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('Guardar button is enabled when name and category are set', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /nombre/i }), { target: { value: 'Leche' } });
    fireEvent.click(screen.getByText(categoryLabel('frescos')));
    expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
  });

  it('clicking Cancelar closes the sheet', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('textbox', { name: /nombre/i })).not.toBeInTheDocument();
  });

  it('Escanear código button is not shown when BarcodeDetector is not supported', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    expect(screen.queryByText(/escanear código/i)).not.toBeInTheDocument();
  });

  it('Escanear código button is shown when BarcodeDetector is supported', () => {
    mockUseBarcodeScanner.mockReturnValue({
      videoRef: { current: null },
      isSupported: true,
      isScanning: false,
      startScan: vi.fn().mockResolvedValue(undefined),
      stopScan: vi.fn(),
    });

    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /agregar producto/i }));
    expect(screen.getByText(/escanear código/i)).toBeInTheDocument();
  });

  // ── Controlled mode ──────────────────────────────────────────────

  it('does not render the FAB when open prop is provided (controlled)', () => {
    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /agregar producto/i })).not.toBeInTheDocument();
  });

  it('renders the sheet when open=true in controlled mode', () => {
    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /nombre/i })).toBeInTheDocument();
  });

  it('does not render the sheet when open=false in controlled mode', () => {
    render(<AddProductSheet open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('textbox', { name: /nombre/i })).not.toBeInTheDocument();
  });

  it('calls onClose when clicking Cancelar in controlled mode', () => {
    const onClose = vi.fn();
    render(<AddProductSheet open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop in controlled mode', () => {
    const onClose = vi.fn();
    render(<AddProductSheet open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Error state ──────────────────────────────────────────────────

  it('shows error message when action returns an error', () => {
    mockUseActionState.mockImplementation(() => [
      { error: 'El producto ya existe.' },
      vi.fn(),
      false,
    ]);
    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    expect(screen.getByText('El producto ya existe.')).toBeInTheDocument();
  });

  // ── Successful form submission ────────────────────────────────────

  it('closes and resets after a successful form action', async () => {
    const onClose = vi.fn();
    // Simulate action that returns no error and triggers close
    mockUseActionState.mockImplementation(
      (action: (prev: unknown, fd: FormData) => Promise<unknown>, initialState: unknown) => {
        const wrappedAction = async (prev: unknown, fd: FormData) => {
          const result = await action(prev, fd);
          return result;
        };
        return [initialState, wrappedAction, false];
      },
    );
    mockAddProductAction.mockResolvedValue({});

    render(<AddProductSheet open={true} onClose={onClose} />);
    // Fill required fields
    fireEvent.change(screen.getByRole('textbox', { name: /nombre/i }), {
      target: { value: 'Leche' },
    });
    fireEvent.click(screen.getByText(categoryLabel('frescos')));

    await act(async () => {
      fireEvent.submit(screen.getByRole('textbox', { name: /nombre/i }).closest('form')!);
    });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  // ── Barcode scan flow ────────────────────────────────────────────

  it('clicking Escanear código opens the BarcodeScanner', () => {
    mockUseBarcodeScanner.mockReturnValue({
      videoRef: { current: null },
      isSupported: true,
      isScanning: false,
      startScan: vi.fn().mockResolvedValue(undefined),
      stopScan: vi.fn(),
    });
    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(/escanear código/i));
    expect(mockBarcodeScanner).toHaveBeenCalled();
  });

  it('lookupBarcode fills name and brand when a product is found after scan', async () => {
    mockUseBarcodeScanner.mockReturnValue({
      videoRef: { current: null },
      isSupported: true,
      isScanning: false,
      startScan: vi.fn().mockResolvedValue(undefined),
      stopScan: vi.fn(),
    });

    mockLookupBarcode.mockResolvedValue({
      name: 'Coca Cola',
      brand: 'Coca-Cola',
      category: 'frescos' as Category,
    });

    // Capture the onScanned callback injected into BarcodeScanner
    let capturedOnScanned: ((code: string) => Promise<void>) | null = null;
    mockBarcodeScanner.mockImplementation(({ onScanned }: { onScanned: (code: string) => Promise<void> }) => {
      capturedOnScanned = onScanned;
      return null;
    });

    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(/escanear código/i));

    await act(async () => {
      await capturedOnScanned!('1234567890');
    });

    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('Coca Cola');
    expect(screen.getByRole('textbox', { name: /marca/i })).toHaveValue('Coca-Cola');
  });

  it('lookupBarcode returns null — name is not populated', async () => {
    mockUseBarcodeScanner.mockReturnValue({
      videoRef: { current: null },
      isSupported: true,
      isScanning: false,
      startScan: vi.fn().mockResolvedValue(undefined),
      stopScan: vi.fn(),
    });

    mockLookupBarcode.mockResolvedValue(null);

    let capturedOnScanned: ((code: string) => Promise<void>) | null = null;
    mockBarcodeScanner.mockImplementation(({ onScanned }: { onScanned: (code: string) => Promise<void> }) => {
      capturedOnScanned = onScanned;
      return null;
    });

    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(/escanear código/i));

    await act(async () => {
      await capturedOnScanned!('9999999999');
    });

    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('');
  });

  // ── price and expiry inputs ──────────────────────────────────────

  it('price field accepts numeric input', () => {
    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    const priceInput = screen.getByLabelText(/precio/i);
    fireEvent.change(priceInput, { target: { value: '3.99' } });
    expect(priceInput).toHaveValue(3.99);
  });

  it('expiry date field accepts a date value', () => {
    render(<AddProductSheet open={true} onClose={vi.fn()} />);
    const dateInputEl = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInputEl, { target: { value: '2025-12-31' } });
    expect(dateInputEl).toHaveValue('2025-12-31');
  });
});
