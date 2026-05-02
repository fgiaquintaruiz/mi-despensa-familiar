import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { PriceHistoryEntry } from '@/lib/types';
import EditForm from './edit-form';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect('/onboarding');
  }

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('household_id', membership.household_id)
    .single();

  if (!product) {
    redirect('/');
  }

  const { data: priceHistory } = await supabase
    .from('price_history')
    .select('id, product_id, price, recorded_at')
    .eq('product_id', id)
    .order('recorded_at', { ascending: false })
    .limit(10);

  return (
    <div className="max-w-[480px] mx-auto px-5 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-sm text-[var(--color-brand)] hover:underline">
          ← Volver
        </Link>
        <h1 className="text-xl font-bold">Editar producto</h1>
      </div>
      <EditForm product={product} priceHistory={(priceHistory ?? []) as PriceHistoryEntry[]} />
    </div>
  );
}
