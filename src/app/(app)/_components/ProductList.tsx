import Link from 'next/link';
import { categoryLabel } from '@/lib/types';
import type { Product } from '@/lib/types';
import DeleteProductButton from './DeleteProductButton';
import ConsumeButton from './ConsumeButton';

interface Props {
  products: Product[];
}

function isLowStock(product: Product): boolean {
  return product.min_stock > 0 && product.current_stock < product.min_stock;
}

function getExpiryStatus(expiresAt: string | null) {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Vencido', color: 'text-red-600 bg-red-50' };
  if (days <= 3) return { label: `Vence en ${days}d`, color: 'text-orange-600 bg-orange-50' };
  if (days <= 7) return { label: `Vence en ${days}d`, color: 'text-yellow-600 bg-yellow-50' };
  return { label: `Vence ${new Date(expiresAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`, color: 'text-green-600 bg-green-50' };
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
            <p className="text-xs text-gray-400">
              Agregado el{' '}
              {new Date(product.created_at).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
            {(() => {
              const expiry = getExpiryStatus(product.expires_at);
              return expiry ? (
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${expiry.color}`}>
                  {expiry.label}
                </span>
              ) : null;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <ConsumeButton productId={product.id} currentStock={product.current_stock} />
            <span className="text-sm font-semibold">{product.current_stock}</span>
            {isLowStock(product) && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">
                stock bajo
              </span>
            )}
            <Link
              href={`/products/${product.id}/edit`}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-brand)] hover:bg-blue-50"
              aria-label={`Editar ${product.name}`}
            >
              Editar
            </Link>
            <DeleteProductButton productId={product.id} productName={product.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}
