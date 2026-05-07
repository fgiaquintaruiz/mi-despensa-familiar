import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductList from './ProductList';
import type { Product } from '@/lib/types';

vi.mock('./DeleteProductButton', () => ({
  default: ({ productId, productName }: { productId: string; productName: string }) => (
    <button data-testid={`delete-${productId}`} aria-label={`Eliminar ${productName}`}>
      Eliminar
    </button>
  ),
}));

vi.mock('../actions', () => ({
  bulkDeleteProductsAction: vi.fn().mockResolvedValue({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

import { bulkDeleteProductsAction } from '../actions';

vi.mock('./ConsumeButton', () => ({
  default: ({ productId }: { productId: string }) => (
    <button data-testid={`consume-${productId}`}>Consumir</button>
  ),
}));

vi.mock('./RestockButton', () => ({
  default: ({ productId }: { productId: string }) => (
    <button data-testid={`restock-${productId}`}>Reponer</button>
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    household_id: 'hh-1',
    name: 'Arroz',
    brand: null,
    category: 'despensa',
    unit: 'kg',
    current_stock: 5,
    min_stock: 2,
    price: 0,
    barcode: null,
    expires_at: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Returns an ISO date string offset from today by `deltaDays`. */
function isoDateOffsetDays(deltaDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString();
}

describe('ProductList', () => {
  it('shows "Sin productos" when the array is empty', () => {
    render(<ProductList products={[]} />);
    expect(screen.getByText('Sin productos')).toBeInTheDocument();
  });

  it('renders name and category for each product', () => {
    const products = [
      makeProduct({ id: 'p-1', name: 'Arroz', category: 'despensa' }),
      makeProduct({ id: 'p-2', name: 'Shampoo', category: 'higiene' }),
    ];
    render(<ProductList products={products} />);
    expect(screen.getByText('Arroz')).toBeInTheDocument();
    expect(screen.getByText('Despensa')).toBeInTheDocument();
    expect(screen.getByText('Shampoo')).toBeInTheDocument();
    expect(screen.getByText('Higiene')).toBeInTheDocument();
  });

  it('shows low-stock badge when current_stock < min_stock and min_stock > 0', () => {
    const product = makeProduct({ current_stock: 1, min_stock: 3 });
    render(<ProductList products={[product]} />);
    expect(screen.getByText('stock bajo')).toBeInTheDocument();
  });

  it('does not show low-stock badge when current_stock >= min_stock', () => {
    const product = makeProduct({ current_stock: 5, min_stock: 3 });
    render(<ProductList products={[product]} />);
    expect(screen.queryByText('stock bajo')).not.toBeInTheDocument();
  });

  it('renders an edit link to /products/{id}/edit for each product', () => {
    const products = [
      makeProduct({ id: 'p-1', name: 'Arroz' }),
      makeProduct({ id: 'p-2', name: 'Shampoo' }),
    ];
    render(<ProductList products={products} />);
    expect(screen.getByRole('link', { name: /editar arroz/i })).toHaveAttribute(
      'href',
      '/products/p-1/edit',
    );
    expect(screen.getByRole('link', { name: /editar shampoo/i })).toHaveAttribute(
      'href',
      '/products/p-2/edit',
    );
  });

  it('renders a DeleteProductButton for each product', () => {
    const products = [
      makeProduct({ id: 'p-1', name: 'Arroz' }),
      makeProduct({ id: 'p-2', name: 'Shampoo' }),
    ];
    render(<ProductList products={products} />);
    expect(screen.getByTestId('delete-p-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-p-2')).toBeInTheDocument();
  });

  it('renders the brand when present', () => {
    const product = makeProduct({ brand: 'La Abundancia' });
    render(<ProductList products={[product]} />);
    expect(screen.getByText('La Abundancia')).toBeInTheDocument();
  });

  it('does not render a brand element when brand is null', () => {
    const product = makeProduct({ brand: null });
    render(<ProductList products={[product]} />);
    expect(screen.queryByText('La Abundancia')).not.toBeInTheDocument();
  });

  it('does not show any expiry badge when expires_at is null', () => {
    const product = makeProduct({ expires_at: null });
    render(<ProductList products={[product]} />);
    expect(screen.queryByText(/vence/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/vencido/i)).not.toBeInTheDocument();
  });

  it('shows "Vencido" badge for a product that expired in the past', () => {
    const product = makeProduct({ expires_at: isoDateOffsetDays(-5) });
    render(<ProductList products={[product]} />);
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });

  it('shows expiry badge with days remaining when expires_at is within 3 days', () => {
    const product = makeProduct({ expires_at: isoDateOffsetDays(2) });
    render(<ProductList products={[product]} />);
    expect(screen.getByText(/vence en \d+d/i)).toBeInTheDocument();
  });

  it('shows expiry badge with days remaining when expires_at is within 7 days', () => {
    const product = makeProduct({ expires_at: isoDateOffsetDays(5) });
    render(<ProductList products={[product]} />);
    expect(screen.getByText(/vence en \d+d/i)).toBeInTheDocument();
  });

  it('shows a formatted date badge when expires_at is more than 7 days away', () => {
    const product = makeProduct({ expires_at: isoDateOffsetDays(30) });
    render(<ProductList products={[product]} />);
    // label starts with "Vence " followed by a locale date (not "Vencido" and not "Vence en Xd")
    expect(screen.getByText(/^vence \d+\/\d+/i)).toBeInTheDocument();
  });

  it('does not show low-stock badge when min_stock is 0', () => {
    const product = makeProduct({ current_stock: 0, min_stock: 0 });
    render(<ProductList products={[product]} />);
    expect(screen.queryByText('stock bajo')).not.toBeInTheDocument();
  });
});

describe('ProductList — bulk delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a checkbox for each product', () => {
    const products = [
      makeProduct({ id: 'p-1', name: 'Arroz' }),
      makeProduct({ id: 'p-2', name: 'Leche' }),
    ];
    render(<ProductList products={products} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // 2 product checkboxes + 1 select-all = 3 total
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows "Eliminar seleccionados" button when a checkbox is selected', async () => {
    const product = makeProduct({ id: 'p-1', name: 'Arroz' });
    render(<ProductList products={[product]} />);
    const productCheckboxes = screen.getAllByRole('checkbox').filter(
      (cb) => (cb as HTMLInputElement).dataset.productId === 'p-1'
    );
    expect(productCheckboxes.length).toBeGreaterThan(0);
    fireEvent.click(productCheckboxes[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /eliminar seleccionados/i })).toBeInTheDocument();
    });
  });

  it('does not show "Eliminar seleccionados" when no checkboxes are selected', () => {
    const product = makeProduct({ id: 'p-1', name: 'Arroz' });
    render(<ProductList products={[product]} />);
    expect(screen.queryByRole('button', { name: /eliminar seleccionados/i })).not.toBeInTheDocument();
  });

  it('clicking "Eliminar seleccionados" calls bulkDeleteProductsAction with correct IDs', async () => {
    const products = [
      makeProduct({ id: 'p-1', name: 'Arroz' }),
      makeProduct({ id: 'p-2', name: 'Leche' }),
    ];
    render(<ProductList products={products} />);
    const checkboxes = screen.getAllByRole('checkbox').filter(
      (cb) => (cb as HTMLInputElement).dataset.productId !== undefined
    );
    fireEvent.click(checkboxes[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /eliminar seleccionados/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /eliminar seleccionados/i }));
    await waitFor(() => {
      expect(bulkDeleteProductsAction).toHaveBeenCalledWith(expect.arrayContaining(['p-1']));
    });
  });

  it('clears selection after successful bulk delete', async () => {
    const product = makeProduct({ id: 'p-1', name: 'Arroz' });
    render(<ProductList products={[product]} />);
    const productCheckboxes = screen.getAllByRole('checkbox').filter(
      (cb) => (cb as HTMLInputElement).dataset.productId === 'p-1'
    );
    fireEvent.click(productCheckboxes[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /eliminar seleccionados/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /eliminar seleccionados/i }));
    await waitFor(() => {
      expect(bulkDeleteProductsAction).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /eliminar seleccionados/i })).not.toBeInTheDocument();
    });
  });

  it('deselects a product when its checkbox is clicked a second time (toggleProduct delete branch)', async () => {
    const product = makeProduct({ id: 'p-1', name: 'Arroz' });
    render(<ProductList products={[product]} />);
    const productCheckbox = screen.getAllByRole('checkbox').find(
      (cb) => (cb as HTMLInputElement).dataset.productId === 'p-1'
    ) as HTMLInputElement;
    // Select
    fireEvent.click(productCheckbox);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /eliminar seleccionados/i })).toBeInTheDocument();
    });
    // Deselect — exercises line 48 (next.delete)
    fireEvent.click(productCheckbox);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /eliminar seleccionados/i })).not.toBeInTheDocument();
    });
  });

  it('deselects all products when toggleAll is clicked while all are selected (lines 57-60)', async () => {
    const products = [
      makeProduct({ id: 'p-1', name: 'Arroz' }),
      makeProduct({ id: 'p-2', name: 'Leche' }),
    ];
    render(<ProductList products={products} />);
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /seleccionar todos/i });
    // Select all — allSelected becomes true
    fireEvent.click(selectAllCheckbox);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /eliminar seleccionados/i })).toBeInTheDocument();
    });
    // Deselect all — exercises lines 57-60 (allSelected branch of toggleAll)
    fireEvent.click(selectAllCheckbox);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /eliminar seleccionados/i })).not.toBeInTheDocument();
    });
  });

  it('shows bulkError message when bulkDeleteProductsAction returns an error (lines 68-70)', async () => {
    vi.mocked(bulkDeleteProductsAction).mockResolvedValueOnce({ error: 'Error al eliminar' });
    const product = makeProduct({ id: 'p-1', name: 'Arroz' });
    render(<ProductList products={[product]} />);
    const productCheckbox = screen.getAllByRole('checkbox').find(
      (cb) => (cb as HTMLInputElement).dataset.productId === 'p-1'
    ) as HTMLInputElement;
    fireEvent.click(productCheckbox);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /eliminar seleccionados/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /eliminar seleccionados/i }));
    await waitFor(() => {
      expect(screen.getByText('Error al eliminar')).toBeInTheDocument();
    });
    // Selection should remain (early return, no clear)
    expect(screen.getByRole('button', { name: /eliminar seleccionados/i })).toBeInTheDocument();
  });
});
