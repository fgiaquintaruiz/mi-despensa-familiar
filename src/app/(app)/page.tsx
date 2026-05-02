import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import DashboardStats from './_components/DashboardStats';
import ProductFilters from './_components/ProductFilters';
import FabSpeedDial from './_components/FabSpeedDial';
import AppHeader from './_components/AppHeader';

export default async function Home() {
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
      <main className="relative mx-auto max-w-[480px] px-5 py-8">
        <AppHeader />
        <DashboardStats total={total} lowStock={lowStock} categories={categories} />
        <ProductFilters products={list} />
      </main>
      <FabSpeedDial />
    </>
  );
}
