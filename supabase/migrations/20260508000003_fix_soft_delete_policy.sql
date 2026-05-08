-- Hotfix: la policy transactions_soft_delete_member no quedó aplicada
-- en producción cuando se corrió la migración 20260508000001.
-- Esta migración la crea idempotentemente.

DROP POLICY IF EXISTS "transactions_soft_delete_member" ON public.shopping_transactions;

CREATE POLICY "transactions_soft_delete_member"
  ON public.shopping_transactions FOR UPDATE
  USING (public.is_household_member(household_id) AND deleted_at IS NULL)
  WITH CHECK (public.is_household_member(household_id));
