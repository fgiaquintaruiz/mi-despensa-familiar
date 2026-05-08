-- 1. Agregar columna
ALTER TABLE public.shopping_transactions
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Actualizar política SELECT para excluir soft-deleted
DROP POLICY IF EXISTS "transactions_select_member" ON public.shopping_transactions;
CREATE POLICY "transactions_select_member"
  ON public.shopping_transactions FOR SELECT
  USING (
    is_household_member(household_id)
    AND deleted_at IS NULL
  );

-- 3. Agregar política UPDATE restringida (solo soft-delete)
CREATE POLICY "transactions_soft_delete_member"
  ON public.shopping_transactions FOR UPDATE
  USING (is_household_member(household_id) AND deleted_at IS NULL)
  WITH CHECK (is_household_member(household_id));
