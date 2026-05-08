import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, isLowStock } from '@/lib/types';
import StatsCharts from './_components/StatsCharts';
import { PageHeader } from '@/app/(app)/_components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user!.id)
    .limit(1)
    .maybeSingle();

  const householdId = membership!.household_id;

  // ── Summary cards ──────────────────────────────────────────────────────────
  const { data: products } = await supabase
    .from('products')
    .select('id, current_stock, min_stock, category')
    .eq('household_id', householdId);

  const totalProducts = products?.length ?? 0;
  const lowStockCount = products?.filter(isLowStock).length ?? 0;

  // Consumption this month (type IS NULL = real consumption, not restock)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count: consumptionsThisMonth } = await supabase
    .from('consumption_logs')
    .select('id', { count: 'exact', head: true })
    .is('type', null)
    .gte('created_at', startOfMonth);

  // ── Top 5 most consumed products ──────────────────────────────────────────
  // Supabase JS doesn't support GROUP BY directly — fetch all consumption logs
  // for this household and aggregate in JS. Scoped by household via product join.
  const { data: allProductIds } = await supabase
    .from('products')
    .select('id, name')
    .eq('household_id', householdId);

  const productIdToName = new Map((allProductIds ?? []).map((p) => [p.id, p.name]));
  const productIdSet = new Set(productIdToName.keys());

  const { data: consumptionLogs } = await supabase
    .from('consumption_logs')
    .select('product_id, qty')
    .is('type', null)
    .in('product_id', Array.from(productIdSet));

  // Aggregate by product_id
  const productTotals = new Map<string, number>();
  for (const log of consumptionLogs ?? []) {
    productTotals.set(log.product_id, (productTotals.get(log.product_id) ?? 0) + log.qty);
  }

  const topProducts = Array.from(productTotals.entries())
    .map(([id, total]) => ({
      name: productIdToName.get(id) ?? id,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // ── Consumption by category ────────────────────────────────────────────────
  const productIdToCategory = new Map(
    (allProductIds ?? []).map((p) => {
      const prod = products?.find((pr) => pr.id === p.id);
      return [p.id, prod?.category ?? 'despensa'];
    }),
  );

  const categoryTotals = new Map<string, number>();
  for (const log of consumptionLogs ?? []) {
    const cat = productIdToCategory.get(log.product_id);
    if (!cat) continue;
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + log.qty);
  }

  const categoryLabelMap = new Map(CATEGORIES.map((c) => [c.key, c.label]));
  const byCategory = Array.from(categoryTotals.entries())
    .map(([key, total]) => ({
      category: categoryLabelMap.get(key as never) ?? key,
      total,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <main className="mx-auto max-w-[480px] px-5 py-8">
      <PageHeader
        breadcrumbs={[{ label: 'Mi Despensa', href: '/' }]}
        title="Estadísticas"
      />

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total productos</p>
          <p className="mt-1 text-2xl font-bold">{totalProducts}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Stock bajo</p>
          <p className="mt-1 text-2xl font-bold text-orange-500">{lowStockCount}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Consumos este mes</p>
          <p className="mt-1 text-2xl font-bold">{consumptionsThisMonth ?? 0}</p>
        </div>
      </div>

      {/* Charts (client component) */}
      <StatsCharts topProducts={topProducts} byCategory={byCategory} />
    </main>
  );
}
