import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditForm from './edit-form';
import type { Product, PriceHistoryEntry } from '@/lib/types';

vi.mock('../../../actions', () => ({
  updateProductAction: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
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

import { useRouter } from 'next/navigation';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    household_id: 'hh-1',
    name: 'Arroz',
    brand: 'La Abundancia',
    category: 'despensa',
    unit: 'kg',
    current_stock: 3,
    min_stock: 1,
    price: 200,
    barcode: null,
    expires_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePriceEntry(overrides: Partial<PriceHistoryEntry> = {}): PriceHistoryEntry {
  return {
    id: 'ph-1',
    product_id: 'p-1',
    price: 150,
    recorded_at: '2024-03-01T00:00:00Z',
    ...overrides,
  };
}

describe('EditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActionState.mockImplementation(
      (action: unknown, initialState: unknown) => [initialState, action, false],
    );
  });

  it('renders with the product name pre-loaded', () => {
    render(<EditForm product={makeProduct()} />);
    expect(screen.getByDisplayValue('Arroz')).toBeInTheDocument();
  });

  it('renders with the product category pre-selected', () => {
    render(<EditForm product={makeProduct({ category: 'despensa' })} />);
    const chip = screen.getByRole('button', { name: /Despensa/i });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('Guardar cambios button is enabled when name is filled', () => {
    render(<EditForm product={makeProduct()} />);
    expect(screen.getByRole('button', { name: /guardar cambios/i })).not.toBeDisabled();
  });

  it('Guardar cambios button is disabled when name is empty', () => {
    render(<EditForm product={makeProduct({ name: 'Arroz' })} />);
    const input = screen.getByDisplayValue('Arroz');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
  });

  it('clicking Cancelar calls router.push("/")', () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush, refresh: vi.fn() } as unknown as ReturnType<typeof useRouter>);
    render(<EditForm product={makeProduct()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  // ── stock counter ────────────────────────────────────────────────

  it('renders the current stock pre-loaded from product', () => {
    render(<EditForm product={makeProduct({ current_stock: 5 })} />);
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('5');
  });

  it('incrementing current stock updates the counter', () => {
    render(<EditForm product={makeProduct({ current_stock: 2 })} />);
    fireEvent.click(screen.getByRole('button', { name: /incrementar cantidad actual/i }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('3');
  });

  it('decrementing current stock updates the counter', () => {
    render(<EditForm product={makeProduct({ current_stock: 2 })} />);
    fireEvent.click(screen.getByRole('button', { name: /decrementar cantidad actual/i }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('1');
  });

  it('current stock does not go below 0', () => {
    render(<EditForm product={makeProduct({ current_stock: 0 })} />);
    fireEvent.click(screen.getByRole('button', { name: /decrementar cantidad actual/i }));
    expect(screen.getByTestId('stock-counter')).toHaveTextContent('0');
  });

  // ── min-stock counter ────────────────────────────────────────────

  it('incrementing min stock updates its display', () => {
    render(<EditForm product={makeProduct({ min_stock: 1 })} />);
    fireEvent.click(screen.getByRole('button', { name: /incrementar stock mínimo/i }));
    // min_stock display is not data-testid'd, but it is the second numeric counter
    const counters = screen.getAllByText('2');
    expect(counters.length).toBeGreaterThanOrEqual(1);
  });

  it('decrementing min stock does not go below 0', () => {
    render(<EditForm product={makeProduct({ min_stock: 0 })} />);
    fireEvent.click(screen.getByRole('button', { name: /decrementar stock mínimo/i }));
    // min_stock stays at 0
    const zeroDisplays = screen.getAllByText('0');
    expect(zeroDisplays.length).toBeGreaterThanOrEqual(1);
  });

  // ── category chip ─────────────────────────────────────────────────

  it('clicking a different category chip selects it', () => {
    render(<EditForm product={makeProduct({ category: 'despensa' })} />);
    const higiene = screen.getByRole('button', { name: /Higiene/i });
    fireEvent.click(higiene);
    expect(higiene).toHaveAttribute('aria-pressed', 'true');
  });

  // ── expiry date fields ────────────────────────────────────────────

  it('pre-fills expiry fields from product.expires_at', () => {
    const product = makeProduct({ expires_at: '2025-12-31T00:00:00Z' });
    render(<EditForm product={product} />);
    expect(screen.getByPlaceholderText('DD')).toHaveValue(31);
    expect(screen.getByPlaceholderText('MM')).toHaveValue(12);
    expect(screen.getByPlaceholderText('AAAA')).toHaveValue(2025);
  });

  it('expiry fields are empty when expires_at is null', () => {
    render(<EditForm product={makeProduct({ expires_at: null })} />);
    expect(screen.getByPlaceholderText('DD')).toHaveValue(null);
    expect(screen.getByPlaceholderText('MM')).toHaveValue(null);
    expect(screen.getByPlaceholderText('AAAA')).toHaveValue(null);
  });

  it('typing into expiry day field updates its value', () => {
    render(<EditForm product={makeProduct({ expires_at: null })} />);
    fireEvent.change(screen.getByPlaceholderText('DD'), { target: { value: '15' } });
    expect(screen.getByPlaceholderText('DD')).toHaveValue(15);
  });

  // ── error state ───────────────────────────────────────────────────

  it('shows an error message when state.error is set', () => {
    mockUseActionState.mockImplementation(() => [
      { error: 'No se pudo guardar el producto.' },
      vi.fn(),
      false,
    ]);
    render(<EditForm product={makeProduct()} />);
    expect(screen.getByText('No se pudo guardar el producto.')).toBeInTheDocument();
  });

  // ── price history section ─────────────────────────────────────────

  it('does not render price history section when fewer than 2 entries', () => {
    const oneEntry = [makePriceEntry()];
    render(<EditForm product={makeProduct()} priceHistory={oneEntry} />);
    expect(screen.queryByText(/historial de precios/i)).not.toBeInTheDocument();
  });

  it('renders price history section when 2 or more entries exist', () => {
    const entries = [
      makePriceEntry({ id: 'ph-1', price: 150, recorded_at: '2024-03-01T00:00:00Z' }),
      makePriceEntry({ id: 'ph-2', price: 175, recorded_at: '2024-04-01T00:00:00Z' }),
    ];
    render(<EditForm product={makeProduct()} priceHistory={entries} />);
    expect(screen.getByText(/historial de precios/i)).toBeInTheDocument();
    expect(screen.getByText('€150.00')).toBeInTheDocument();
    expect(screen.getByText('€175.00')).toBeInTheDocument();
  });

  it('defaults priceHistory to empty array when not provided', () => {
    render(<EditForm product={makeProduct()} />);
    expect(screen.queryByText(/historial de precios/i)).not.toBeInTheDocument();
  });
});
