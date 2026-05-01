'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, type Category } from '@/lib/types';

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));

export async function addProductAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const categoryRaw = (formData.get('category') as string | null) ?? '';
  const stockRaw = formData.get('current_stock');
  const current_stock = stockRaw ? Number(stockRaw) : 1;

  if (!name) {
    return { error: 'El nombre del producto es obligatorio.' };
  }

  if (!VALID_CATEGORIES.has(categoryRaw)) {
    return { error: 'Categoría inválida.' };
  }

  const category = categoryRaw as Category;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado' };
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('products').insert({
    household_id: membership!.household_id,
    name,
    category,
    current_stock,
    brand: null,
    unit: null,
    min_stock: 0,
    price: 0,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/');
  return {};
}

export async function updateProductAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const id = (formData.get('id') as string | null)?.trim() ?? '';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const categoryRaw = (formData.get('category') as string | null) ?? '';
  const current_stock = Number(formData.get('current_stock') ?? 0);
  const min_stock = Number(formData.get('min_stock') ?? 0);
  const brand = (formData.get('brand') as string | null)?.trim() || null;
  const unit = (formData.get('unit') as string | null)?.trim() || null;
  const price = Number(formData.get('price') ?? 0);

  if (!id) {
    return { error: 'ID del producto es obligatorio.' };
  }

  if (!name) {
    return { error: 'El nombre del producto es obligatorio.' };
  }

  if (!VALID_CATEGORIES.has(categoryRaw)) {
    return { error: 'Categoría inválida.' };
  }

  const category = categoryRaw as Category;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado' };
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('products')
    .update({ name, category, current_stock, min_stock, brand, unit, price })
    .eq('id', id)
    .eq('household_id', membership!.household_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/');
  return {};
}

export async function deleteProductAction(productId: string): Promise<{ error?: string }> {
  if (!productId) {
    return { error: 'ID del producto es obligatorio.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado' };
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('household_id', membership!.household_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/');
  return {};
}
