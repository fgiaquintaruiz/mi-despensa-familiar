import type { Product, ConsumptionLog } from './types';

export interface ShoppingListItem extends Product {
  qty_to_buy: number;
  estimated_price: number;
}

export function calculateShoppingList(
  products: Product[],
  logs: ConsumptionLog[],
  now: Date = new Date(),
): ShoppingListItem[] {
  const logsByProduct = new Map<string, ConsumptionLog[]>();
  logs.forEach((log) => {
    const list = logsByProduct.get(log.product_id) || [];
    list.push(log);
    logsByProduct.set(log.product_id, list);
  });

  return products
    .map((product) => {
      const pLogs = logsByProduct.get(product.id) || [];
      let avg_diario = 0;

      if (pLogs.length > 0) {
        // Find earliest log date
        const earliestDate = new Date(Math.min(...pLogs.map((l) => new Date(l.date).getTime())));
        const diffTime = Math.abs(now.getTime() - earliestDate.getTime());
        const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const totalConsumed = pLogs.reduce((sum, l) => sum + Number(l.qty), 0);
        avg_diario = totalConsumed / days;
      }

      let qty_to_buy = 0;
      if (avg_diario > 0) {
        qty_to_buy = Math.max(0, Math.ceil(avg_diario * 30) - Number(product.current_stock));
      } else if (
        Number(product.current_stock) <= Number(product.min_stock) &&
        Number(product.min_stock) > 0
      ) {
        qty_to_buy = Number(product.min_stock) * 2 - Number(product.current_stock);
      }

      return {
        ...product,
        qty_to_buy,
        estimated_price: qty_to_buy * Number(product.price),
      };
    })
    .filter((item) => item.qty_to_buy > 0);
}
