-- BUG-1.3: soft-delete real para products (consistente con shopping_transactions)
--
-- Contexto: el flujo "También quitar productos del stock" en
-- softDeleteTransactionAction fallaba silenciosamente al intentar
-- bajar current_stock por UPDATE directo (RLS bloqueaba sin que se
-- leyera el error). Decisión arquitectónica: soft-delete real con
-- columna deleted_at + RPC SECURITY DEFINER, mismo patrón que tickets.

-- 1. Add soft-delete column
ALTER TABLE public.products
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Partial index (efficient for WHERE deleted_at IS NULL queries)
CREATE INDEX idx_products_deleted_at
ON public.products(deleted_at)
WHERE deleted_at IS NULL;

-- 3. SELECT policy — filter soft-deleted
DROP POLICY IF EXISTS "products_select_member" ON public.products;
CREATE POLICY "products_select_member"
  ON public.products FOR SELECT
  USING (is_household_member(household_id) AND deleted_at IS NULL);

-- 4. UPDATE policy for soft-delete operations
DROP POLICY IF EXISTS "products_soft_delete_member" ON public.products;
CREATE POLICY "products_soft_delete_member"
  ON public.products FOR UPDATE
  USING (is_household_member(household_id) AND deleted_at IS NULL)
  WITH CHECK (is_household_member(household_id));

-- 5. RPC SECURITY DEFINER (idempotent: no falla si ya está deleted)
CREATE OR REPLACE FUNCTION public.soft_delete_product(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = p_id
      AND public.is_household_member(household_id)
  ) THEN
    RAISE EXCEPTION 'Product not found or not authorized'
      USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.products
  SET deleted_at = NOW()
  WHERE id = p_id AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_product(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_product(uuid) TO authenticated;
