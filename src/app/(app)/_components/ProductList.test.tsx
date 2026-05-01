import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductList from './ProductList';
import type { Product } from '@/lib/types';

vi.mock('./DeleteProductButton', () => ({
  default: ({ productId, productName }: { productId: string; productName: string }) => (
    <button data-testid={`delete-${productId}`} aria-label={`Eliminar ${productName}`}>
      Eliminar
    </button>
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
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
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
});
