import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isLowStock } from '@/lib/types';
import type { Product } from '@/lib/types';
import DashboardStats from './_components/DashboardStats';
import ProductFilters from './_components/ProductFilters';
import FabSpeedDial from './_components/FabSpeedDial';
import { ImportSuccessToast } from './_components/ImportSuccessToast';
import BudgetWidget from './_components/BudgetWidget';
import { getBudgetSummaryAction } from './budget/actions';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const { imported } = await searchParams;
  const importedCount = imported ? Number(imported) : 0;

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

  const [{ data: products }, { data: budgetSummary }] = await Promise.all([
    supabase.from('products').select('*').eq('household_id', membership!.household_id).order('name'),
    getBudgetSummaryAction(),
  ]);

  const list: Product[] = products ?? [];

  const total = list.length;
  const lowStock = list.filter(isLowStock).length;
  const categories = new Set(list.map((p) => p.category)).size;

  return (
    <>
      {importedCount > 0 && (
        <Suspense fallback={null}>
          <ImportSuccessToast count={importedCount} />
        </Suspense>
      )}
      <main className="pb-28">
        <DashboardStats total={total} lowStock={lowStock} categories={categories} />
        <div className="mt-4 mb-4">
          <BudgetWidget summary={budgetSummary ?? null} />
        </div>
        <ProductFilters products={list} />
      </main>
      <FabSpeedDial />
    </>
  );
}
