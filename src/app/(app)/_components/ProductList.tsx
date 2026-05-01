import { categoryLabel } from '@/lib/types';
import type { Product } from '@/lib/types';

interface Props {
  products: Product[];
}

function isLowStock(product: Product): boolean {
  return product.min_stock > 0 && product.current_stock < product.min_stock;
}

export default function ProductList({ products }: Props) {
  if (products.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-gray-400">Sin productos</p>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {products.map((product) => (
        <li
          key={product.id}
          className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
        >
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-gray-500">{categoryLabel(product.category)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{product.current_stock}</span>
            {isLowStock(product) && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                stock bajo
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
