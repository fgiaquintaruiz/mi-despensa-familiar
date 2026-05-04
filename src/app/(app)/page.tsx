import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import DashboardStats from './_components/DashboardStats';
import ProductFilters from './_components/ProductFilters';
import FabSpeedDial from './_components/FabSpeedDial';
import { ImportSuccessToast } from './_components/ImportSuccessToast';

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

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('household_id', membership!.household_id)
    .order('name');

  const list: Product[] = products ?? [];

  const total = list.length;
  const lowStock = list.filter(
    (p) => p.min_stock > 0 && p.current_stock < p.min_stock,
  ).length;
  const categories = new Set(list.map((p) => p.category)).size;

  return (
    <>
      {importedCount > 0 && (
        <Suspense fallback={null}>
          <ImportSuccessToast count={importedCount} />
        </Suspense>
      )}
      <main className="pb-8">
        <DashboardStats total={total} lowStock={lowStock} categories={categories} />
        <ProductFilters products={list} />
      </main>
      <FabSpeedDial />
    </>
  );
}
