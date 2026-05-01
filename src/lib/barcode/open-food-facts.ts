import type { Category } from '@/lib/types';

export interface FoodProduct {
  name: string;
  brand: string | null;
  category: Category | null;
  barcode: string;
}

const CATEGORY_MAP: Array<[string, Category]> = [
  ['en:beverages', 'frescos'],
  ['en:water', 'frescos'],
  ['en:dairy', 'frescos'],
  ['en:milk', 'frescos'],
  ['en:meats', 'frescos'],
  ['en:fish', 'frescos'],
  ['en:hygiene', 'higiene'],
  ['en:beauty', 'higiene'],
  ['en:baby', 'bebe'],
  ['en:baby-foods', 'bebe'],
  ['en:cleaning', 'limpieza'],
  ['en:household', 'limpieza'],
  ['en:medications', 'farmacia'],
  ['en:health', 'farmacia'],
];

function mapCategory(tags: string[]): Category {
  for (const tag of tags) {
    for (const [key, category] of CATEGORY_MAP) {
      if (tag === key) return category;
    }
  }
  return 'despensa';
}

export async function lookupBarcode(barcode: string): Promise<FoodProduct | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,categories_tags`;
    const response = await fetch(url);
    const data = await response.json() as {
      status: number;
      product?: {
        product_name?: string;
        brands?: string;
        categories_tags?: string[];
      };
    };

    if (data.status !== 1 || !data.product) {
      return null;
    }

    const { product } = data;
    const name = product.product_name ?? '';
    const brandsRaw = product.brands ?? null;
    const brand = brandsRaw ? brandsRaw.split(',')[0].trim() || null : null;
    const tags = product.categories_tags ?? [];
    const category = tags.length > 0 ? mapCategory(tags) : null;

    return { name, brand, category, barcode };
  } catch {
    return null;
  }
}
