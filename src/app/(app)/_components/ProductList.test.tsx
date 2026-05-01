import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductList from './ProductList';
import type { Product } from '@/lib/types';

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
});
