import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import DashboardStats from './_components/DashboardStats';
import ProductList from './_components/ProductList';
import AddProductSheet from './_components/AddProductSheet';
import LogoutButton from './_components/LogoutButton';

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
      <main className="mx-auto max-w-[480px] px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-[var(--color-brand)]">Mi Despensa</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/shopping-list"
              className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-[var(--color-brand)]"
            >
              Lista compra
            </Link>
            <Link
              href="/import-ticket"
              className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-[var(--color-brand)]"
            >
              Importar ticket
            </Link>
            <LogoutButton />
          </div>
        </div>
        <DashboardStats total={total} lowStock={lowStock} categories={categories} />
        <ProductList products={list} />
      </main>
      <AddProductSheet />
    </>
  );
}
