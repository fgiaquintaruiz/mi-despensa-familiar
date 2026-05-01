import { describe, it, expect } from 'vitest';
import { calculateShoppingList } from './shopping-list';
import type { Product, ConsumptionLog } from './types';

describe('calculateShoppingList', () => {
  const mockNow = new Date('2024-05-10T12:00:00Z');

  const mockProducts: Product[] = [
    {
      id: 'p1',
      name: 'Milk',
      current_stock: 2,
      min_stock: 5,
      price: 1.5,
      category: 'frescos',
      household_id: 'h1',
      brand: null,
      unit: 'uds',
      barcode: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'p2',
      name: 'Bread',
      current_stock: 1,
      min_stock: 2,
      price: 1.0,
      category: 'despensa',
      household_id: 'h1',
      brand: null,
      unit: 'uds',
      barcode: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'p3',
      name: 'Coke',
      current_stock: 10,
      min_stock: 5,
      price: 2.0,
      category: 'despensa',
      household_id: 'h1',
      brand: null,
      unit: 'uds',
      barcode: null,
      created_at: '',
      updated_at: '',
    },
  ];

  it('calculates based on min_stock if no history', () => {
    const items = calculateShoppingList(mockProducts, [], mockNow);
    
    // p1: current 2, min 5 -> to buy (5*2) - 2 = 8
    // p2: current 1, min 2 -> to buy (2*2) - 1 = 3
    // p3: current 10, min 5 -> to buy 0
    
    expect(items).toHaveLength(2);
    expect(items.find(i => i.id === 'p1')?.qty_to_buy).toBe(8);
    expect(items.find(i => i.id === 'p2')?.qty_to_buy).toBe(3);
  });

  it('calculates based on consumption history', () => {
    const logs: ConsumptionLog[] = [
      { id: 'l1', product_id: 'p1', qty: 10, date: '2024-05-01T12:00:00Z', type: null, created_at: '' },
      { id: 'l2', product_id: 'p1', qty: 10, date: '2024-05-06T12:00:00Z', type: null, created_at: '' },
    ];
    
    // p1: 
    // Earliest log: May 1st
    // Now: May 10th
    // Days: 9 (ceil(diff / 24h)) -> Wait, the logic used diffTime / (1000*60*60*24)
    // May 10th 12:00 - May 1st 12:00 = 9.0 days. Ceil = 9.
    // Total consumed: 20
    // Avg diario: 20 / 9 = 2.22
    // Qty to buy: ceil(2.22 * 30) - 2 = 67 - 2 = 65.
    
    const items = calculateShoppingList(mockProducts, logs, mockNow);
    const p1 = items.find(i => i.id === 'p1');
    expect(p1?.qty_to_buy).toBe(65);
  });

  it('handles min 1 day for consumption history', () => {
    const logs: ConsumptionLog[] = [
      { id: 'l1', product_id: 'p1', qty: 5, date: '2024-05-10T11:00:00Z', type: null, created_at: '' },
    ];
    
    // p1: 
    // Earliest log: May 10th 11:00
    // Now: May 10th 12:00
    // Diff: 1h. Days: ceil(1/24) = 1.
    // Total: 5. Avg: 5/1 = 5.
    // Qty to buy: ceil(5 * 30) - 2 = 150 - 2 = 148.
    
    const items = calculateShoppingList(mockProducts, logs, mockNow);
    const p1 = items.find(i => i.id === 'p1');
    expect(p1?.qty_to_buy).toBe(148);
  });
});
