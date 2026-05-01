import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EditForm from './edit-form';
import type { Product } from '@/lib/types';

vi.mock('../../../actions', () => ({
  updateProductAction: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: (action: unknown, initialState: unknown) => [initialState, action, false],
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
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('EditForm', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
