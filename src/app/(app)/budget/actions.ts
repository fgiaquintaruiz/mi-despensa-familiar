'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type {
  Budget,
  BudgetCurrency,
  BudgetInsert,
  BudgetSummary,
  ShoppingTransaction,
  ShoppingTransactionInsert,
  ShoppingTransactionTag,
  TransactionItem,
} from '@/lib/types';
import { SHOPPING_TRANSACTION_TAGS } from '@/lib/types';

const VALID_CURRENCIES: BudgetCurrency[] = ['EUR', 'USD', 'ARS'];

const DEFAULT_TRANSACTION_TAG: ShoppingTransactionTag = 'diaria';

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Computes end_date from start_date and period_type. */
function computeEndDate(startDate: string, periodType: 'monthly' | 'biweekly'): string {
  const start = new Date(startDate);
  if (periodType === 'monthly') {
    start.setMonth(start.getMonth() + 1);
  } else {
    start.setDate(start.getDate() + 14);
  }
  return start.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// getBudgetSummaryAction
// ---------------------------------------------------------------------------
/**
 * Returns the BudgetSummary for the current active period of the user's household.
 * Returns { data: undefined } if no active budget covers today.
 *
 * 2 queries — no N+1:
 *  1. SELECT budget (active, covers today)
 *  2. SELECT SUM via bulk transactions fetch
 */
export async function getBudgetSummaryAction(): Promise<{ data?: BudgetSummary; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' };

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: 'No se encontró el hogar' };

  const today = new Date().toISOString().split('T')[0];

  const { data: budget, error: budgetError } = await supabase
    .from('budgets')
    .select('*')
    .eq('household_id', membership.household_id)
    .eq('is_active', true)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (budgetError) return { error: budgetError.message };
  if (!budget) return { data: undefined };

  const { data: aggData, error: aggError } = await supabase
    .from('shopping_transactions')
    .select('*')
    .eq('household_id', membership.household_id)
    .gte('transaction_date', budget.start_date)
    .lte('transaction_date', budget.end_date)
    .order('transaction_date', { ascending: false });

  if (aggError) return { error: aggError.message };

  const transactions = (aggData ?? []) as ShoppingTransaction[];
  const spent = transactions.reduce((acc, t) => acc + Number(t.total_amount), 0);
  const remaining = Number(budget.amount) - spent;
  const percentage = Math.min(100, Math.round((spent / Number(budget.amount)) * 100));

  const manual_amount = transactions
    .filter((t) => t.source === 'manual')
    .reduce((acc, t) => acc + Number(t.total_amount), 0);
  const auto_amount = transactions
    .filter((t) => t.source !== 'manual')
    .reduce((acc, t) => acc + Number(t.total_amount), 0);

  const typedBudget = budget as Budget;

  return {
    data: {
      budget: typedBudget,
      spent,
      remaining,
      percentage,
      transactionCount: transactions.length,
      currency: typedBudget.currency ?? 'EUR',
      manual_amount,
      auto_amount,
      has_manual: manual_amount > 0,
      transactions,
    },
  };
}

// ---------------------------------------------------------------------------
// createBudgetAction
// ---------------------------------------------------------------------------
/**
 * Creates a new budget for the authenticated user's household.
 * Deactivates the previous active budget before inserting the new one.
 */
export async function createBudgetAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string; budgetId?: string }> {
  const amountRaw = formData.get('amount');
  const periodType = formData.get('period_type') as 'monthly' | 'biweekly' | null;
  const startDate = (formData.get('start_date') as string | null)?.trim() ?? '';
  const currencyRaw = (formData.get('currency') as string | null)?.trim() || 'EUR';

  const amount = Number(amountRaw);

  if (!amount || amount <= 0) return { error: 'El monto debe ser mayor a 0.' };
  if (!periodType || !['monthly', 'biweekly'].includes(periodType)) {
    return { error: 'Período inválido.' };
  }
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { error: 'Fecha de inicio inválida.' };
  }
  if (!VALID_CURRENCIES.includes(currencyRaw as BudgetCurrency)) {
    return { error: 'Moneda inválida.' };
  }

  const currency = currencyRaw as BudgetCurrency;
  const endDate = computeEndDate(startDate, periodType);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' };

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: 'No se encontró el hogar' };

  // Deactivate previous active budget
  await supabase
    .from('budgets')
    .update({ is_active: false })
    .eq('household_id', membership.household_id)
    .eq('is_active', true);

  const insert: BudgetInsert = {
    household_id: membership.household_id,
    amount,
    period_type: periodType,
    start_date: startDate,
    end_date: endDate,
    is_active: true,
    currency,
  };

  const { data: newBudget, error } = await supabase
    .from('budgets')
    .insert(insert)
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/budget', 'layout');
  return { budgetId: newBudget.id };
}

// ---------------------------------------------------------------------------
// getTransactionsForBudgetAction
// ---------------------------------------------------------------------------
/**
 * Returns shopping_transactions for the period of a specific budget.
 * Ordered DESC by transaction_date. RLS enforced via household_id.
 */
export async function getTransactionsForBudgetAction(
  budgetId: string,
): Promise<{ data?: ShoppingTransaction[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' };

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: 'No se encontró el hogar' };

  // Verify ownership before reading transactions
  const { data: budget } = await supabase
    .from('budgets')
    .select('start_date, end_date')
    .eq('id', budgetId)
    .eq('household_id', membership.household_id)
    .single();

  if (!budget) return { error: 'Budget no encontrado' };

  const { data, error } = await supabase
    .from('shopping_transactions')
    .select('*')
    .eq('household_id', membership.household_id)
    .gte('transaction_date', budget.start_date)
    .lte('transaction_date', budget.end_date)
    .order('transaction_date', { ascending: false });

  if (error) return { error: error.message };
  return { data: data ?? [] };
}

// ---------------------------------------------------------------------------
// createManualTransactionAction
// ---------------------------------------------------------------------------
/**
 * Creates a manual shopping_transaction (source='manual') without items.
 * Used to record out-of-app expenses that should count against the budget.
 */
export async function createManualTransactionAction(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const amountRaw = formData.get('amount');
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const dateRaw = (formData.get('date') as string | null)?.trim() ?? '';
  const tagRaw = (formData.get('tag') as string | null)?.trim() ?? '';

  const amount = Number(amountRaw);

  if (!amount || amount <= 0) return { error: 'El monto debe ser mayor a 0.' };

  // Defense in depth: validate tag at the action boundary in addition to the DB CHECK.
  let tag: ShoppingTransactionTag;
  if (tagRaw === '') {
    tag = DEFAULT_TRANSACTION_TAG;
  } else if (SHOPPING_TRANSACTION_TAGS.includes(tagRaw as ShoppingTransactionTag)) {
    tag = tagRaw as ShoppingTransactionTag;
  } else {
    return { error: 'Tag inválido.' };
  }

  const today = new Date().toISOString().split('T')[0];
  const transactionDate = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : today;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' };

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return { error: 'No se encontró el hogar' };

  const insert: ShoppingTransactionInsert = {
    household_id: membership.household_id,
    total_amount: amount,
    item_count: 0,
    source: 'manual',
    store_name: description || 'Gasto manual',
    transaction_date: transactionDate,
    tag,
  };

  const { error } = await supabase.from('shopping_transactions').insert(insert);

  if (error) return { error: error.message };

  revalidatePath('/budget', 'layout');
  return {};
}

// ---------------------------------------------------------------------------
// getTransactionItemsAction
// ---------------------------------------------------------------------------
/**
 * Returns items for a specific transaction (drill-down).
 * RLS guarantees the user can only see items from their household's transactions.
 */
export async function getTransactionItemsAction(
  transactionId: string,
): Promise<{ data?: TransactionItem[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' };

  const { data, error } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('line_total', { ascending: false });

  if (error) return { error: error.message };
  return { data: data ?? [] };
}

// ---------------------------------------------------------------------------
// softDeleteTransactionAction
// ---------------------------------------------------------------------------
/**
 * Soft-deletes a shopping_transaction by setting deleted_at = now().
 * RLS SELECT policy already filters WHERE deleted_at IS NULL, so the
 * transaction is automatically excluded from budget calculations.
 *
 * If removeStock is true, fetches transaction_items and decrements
 * current_stock on each linked product (floors at 0, never negative).
 */
export type SoftDeleteErrorCode = 'transaction_gone' | 'product_delete_failed';

export async function softDeleteTransactionAction(
  transactionId: string,
  removeStock: boolean,
): Promise<{ ok?: never; error?: string; code?: SoftDeleteErrorCode } | { ok: false; code: 'product_delete_failed'; error: string }> {
  if (!transactionId || transactionId.trim() === '') {
    return { error: 'El id de la transacción es requerido' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: 'No autenticado' };

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return { error: 'No se encontró el hogar' };

  // Soft-delete via SECURITY DEFINER RPC: bypasses the RLS UPDATE-policy bug
  // where USING + WITH CHECK clauses on shopping_transactions were rejecting
  // the row transition deleted_at IS NULL → NOT NULL. The RPC validates
  // household membership internally before performing the UPDATE.
  const { error: deleteError } = await supabase.rpc('soft_delete_transaction', {
    t_id: transactionId,
  });

  if (deleteError) {
    // Map known RPC errors to friendly Spanish messages.
    if (deleteError.message === 'Transaction not found or not authorized') {
      return {
        error: 'Este gasto ya no existe. Refrescá la pantalla.',
        code: 'transaction_gone',
      };
    }
    return { error: deleteError.message };
  }

  // Optionally soft-delete products linked to this transaction's items
  if (removeStock) {
    const { data: items, error: itemsError } = await supabase
      .from('transaction_items')
      .select('id, product_id, quantity')
      .eq('transaction_id', transactionId);

    if (itemsError) return { error: itemsError.message };

    const itemsToProcess = (items ?? []).filter(
      (item): item is typeof item & { product_id: string } => item.product_id !== null,
    );

    for (const item of itemsToProcess) {
      const { error: rpcError } = await supabase.rpc('soft_delete_product', {
        p_id: item.product_id,
      });

      if (rpcError) {
        return { ok: false, code: 'product_delete_failed', error: rpcError.message };
      }
    }
  }

  revalidatePath('/budget', 'layout');

  if (removeStock) {
    // Revalidate all paths that display stock/product data so PWA caches
    // are busted on mobile after a soft-delete with stock removal.
    revalidatePath('/dashboard');
    revalidatePath('/');
  }

  return {};
}

// ---------------------------------------------------------------------------
// deleteProductAction
// ---------------------------------------------------------------------------
/**
 * Soft-deletes a single product by setting deleted_at = now() via the
 * SECURITY DEFINER RPC `soft_delete_product`. The RPC validates ownership
 * internally — no TOCTOU risk from client-side ownership checks.
 */
export async function deleteProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('soft_delete_product', { p_id: productId });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/');

  return { ok: true };
}
