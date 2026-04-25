export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  unit: string;
  currentStock: number;
  minStock: number;
  price: number;
  barcode: string;
}

export interface ConsumptionLog {
  id: string;
  productId: string;
  qty: number;
  date: string;
  type?: 'restock';
}

export const CATEGORIES = [
  '🍞 Despensa',
  '🧴 Higiene',
  '👶 Bebé/Niñas',
  '🧹 Limpieza',
  '🥛 Frescos',
  '💊 Farmacia',
] as const;

export type Category = (typeof CATEGORIES)[number];
