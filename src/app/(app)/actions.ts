'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, type Category } from '@/lib/types';

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function addProductAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const categoryRaw = (formData.get('category') as string | null) ?? '';
  const stockRaw = formData.get('current_stock');
  const current_stock = stockRaw ? Number(stockRaw) : 1;
  const barcode = (formData.get('barcode') as string | null)?.trim() || null;
  const brand = (formData.get('brand') as string | null)?.trim() || null;
  const price = Number(formData.get('price') ?? 0);
  const expiresAtRaw = (formData.get('expires_at') as string | null)?.trim() || null;
  const expires_at = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

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

  const { data: newProduct, error } = await supabase
    .from('products')
    .insert({
      household_id: membership!.household_id,
      name,
      category,
      current_stock,
      brand,
      unit: null,
      min_stock: 0,
      price,
      barcode: barcode || null,
      expires_at,
    })
    .select('id')
    .single();

  if (error) {
    return { error: error.message };
  }

  if (price > 0 && newProduct) {
    await supabase.from('price_history').insert({ product_id: newProduct.id, price });
  }

  revalidatePath('/', 'layout');
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
  const expiresAtRaw = (formData.get('expires_at') as string | null)?.trim() || null;
  const expires_at = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

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

  const { data: existing } = await supabase
    .from('products')
    .select('price')
    .eq('id', id)
    .eq('household_id', membership!.household_id)
    .single();

  const { error } = await supabase
    .from('products')
    .update({ name, category, current_stock, min_stock, brand, unit, price, expires_at })
    .eq('id', id)
    .eq('household_id', membership!.household_id);

  if (error) {
    return { error: error.message };
  }

  if (existing && price !== existing.price) {
    await supabase.from('price_history').insert({ product_id: id, price });
  }

  revalidatePath('/', 'layout');
  return {};
}

export async function importTicketItemsAction(
  items: Array<{ name: string; qty: number; price: number; category: Category }>,
): Promise<{ error?: string; imported: number }> {
  if (items.length === 0) return { imported: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado', imported: 0 };

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: 'No se encontró el hogar', imported: 0 };

  // Fetch all existing products for this household for deduplication
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, name, current_stock')
    .eq('household_id', membership.household_id);

  const productMap = new Map((existingProducts || []).map((p) => [p.name.toLowerCase(), p]));

  let importedCount = 0;

  for (const item of items) {
    const existing = productMap.get(item.name.toLowerCase());
    let productId: string;

    if (existing) {
      productId = existing.id;
      // Update existing product
      const { error: updateError } = await supabase
        .from('products')
        .update({
          current_stock: Number(existing.current_stock) + item.qty,
          price: item.price,
        })
        .eq('id', existing.id);

      if (updateError) continue;

      // Update local map for subsequent items in the same ticket
      existing.current_stock = Number(existing.current_stock) + item.qty;
    } else {
      // Insert new product
      const { data: newProduct, error: insertError } = await supabase
        .from('products')
        .insert({
          household_id: membership.household_id,
          name: item.name,
          category: item.category,
          current_stock: item.qty,
          price: item.price,
          brand: null,
          unit: null,
          min_stock: 0,
        })
        .select('id')
        .single();

      if (insertError || !newProduct) continue;
      productId = newProduct.id;

      // Add to local map
      productMap.set(item.name.toLowerCase(), {
        id: productId,
        name: item.name,
        current_stock: item.qty,
      });
    }

    // Log restock
    await supabase.from('consumption_logs').insert({
      product_id: productId,
      qty: item.qty,
      type: 'restock',
    });

    importedCount++;
  }

  revalidatePath('/', 'layout');
  return { imported: importedCount };
}

export async function consumeProductAction(productId: string): Promise<{ error?: string }> {
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

  if (!membership) {
    return { error: 'No se encontró el hogar' };
  }

  // 1. Fetch current product to check stock
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('id, current_stock, min_stock, name, unit')
    .eq('id', productId)
    .eq('household_id', membership.household_id)
    .single();

  if (fetchError || !product) {
    return { error: 'Producto no encontrado' };
  }

  if (product.current_stock <= 0) {
    return { error: 'No hay stock disponible' };
  }

  // 2. Decrement stock
  const { error: updateError } = await supabase
    .from('products')
    .update({ current_stock: product.current_stock - 1 })
    .eq('id', productId);

  if (updateError) {
    return { error: updateError.message };
  }

  // 3. Log consumption
  await supabase.from('consumption_logs').insert({
    product_id: productId,
    qty: 1,
    type: null,
  });

  // 4. Send low-stock push notification if stock dropped below min_stock
  const newStock = product.current_stock - 1;
  if (product.min_stock > 0 && newStock < product.min_stock) {
    const unitLabel = product.unit ?? 'unidades';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    // Fire-and-forget — don't block the action on notification delivery
    fetch(`${appUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        payload: {
          title: 'Stock bajo',
          body: `${product.name} está por agotarse (${newStock} ${unitLabel} restantes)`,
          url: '/products',
        },
      }),
    }).catch(() => {
      // Notification failure must never break the consume action
    });
  }

  revalidatePath('/', 'layout');
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

  revalidatePath('/', 'layout');
  return {};
}
