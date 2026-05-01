import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

vi.mock('../actions', () => ({
  addProductAction: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: (action: unknown, initialState: unknown) => [initialState, action, false],
  };
});

vi.mock('@/lib/barcode/open-food-facts', () => ({
  lookupBarcode: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/barcode/use-barcode-scanner', () => ({
  useBarcodeScanner: mockUseBarcodeScanner,
}));

vi.mock('./BarcodeScanner', () => ({
  default: vi.fn().mockReturnValue(null),
}));

describe('AddProductSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByRole('button', { name: /\+/i })).toBeInTheDocument();
  });

  it('sheet is hidden by default', () => {
    render(<AddProductSheet />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('clicking the FAB opens the sheet and shows the form', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('sheet renders all 6 category chips with correct labels', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    for (const cat of CATEGORIES) {
      expect(screen.getByText(categoryLabel(cat.key as Category))).toBeInTheDocument();
    }
  });

  it('clicking a category chip selects it', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    const chip = screen.getByText(categoryLabel('despensa'));
    fireEvent.click(chip);
    expect(chip.closest('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a second category chip deselects the first', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    const chip1 = screen.getByText(categoryLabel('despensa'));
    const chip2 = screen.getByText(categoryLabel('higiene'));
    fireEvent.click(chip1);
    fireEvent.click(chip2);
    expect(chip1.closest('button')).toHaveAttribute('aria-pressed', 'false');
    expect(chip2.closest('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('counter starts at 1', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('1');
  });

  it('clicking "+" on counter increments to 2', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Incrementar cantidad' }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('2');
  });

  it('clicking "−" on counter decrements from 2 to 1', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Incrementar cantidad' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrementar cantidad' }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('1');
  });

  it('counter does not go below 1', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrementar cantidad' }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('1');
  });

  it('Guardar button is disabled when name is empty', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('Guardar button is disabled when category is not selected', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Leche' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('Guardar button is enabled when name and category are set', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Leche' } });
    fireEvent.click(screen.getByText(categoryLabel('frescos')));
    expect(screen.getByRole('button', { name: 'Guardar' })).not.toBeDisabled();
  });

  it('clicking Cancelar closes the sheet', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Escanear código button is not shown when BarcodeDetector is not supported', () => {
    render(<AddProductSheet />);
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /\+/i }));
    expect(screen.getByText(/escanear código/i)).toBeInTheDocument();
  });
});
