'use client';

import { useState, useMemo } from 'react';
import { CATEGORIES, categoryEmoji } from '@/lib/types';
import type { Product, Category } from '@/lib/types';
import ProductList from './ProductList';

interface Props {
  products: Product[];
}

export default function ProductFilters({ products }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const filtered = useMemo(() => {
    let result = products;

    if (activeCategory !== 'all') {
      result = result.filter((p) => p.category === activeCategory);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    return result;
  }, [products, searchQuery, activeCategory]);

  return (
    <div className="mt-4">
      {/* Search input */}
      <div className="relative mb-3">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="mb-1 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            activeCategory === 'all'
              ? 'bg-[var(--color-brand)] text-white'
              : 'bg-white text-gray-600 shadow-sm'
          }`}
        >
          Todos
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key as Category)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeCategory === cat.key
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            {categoryEmoji(cat.key as Category)} {cat.label}
          </button>
        ))}
      </div>

      <ProductList products={filtered} />
    </div>
  );
}
