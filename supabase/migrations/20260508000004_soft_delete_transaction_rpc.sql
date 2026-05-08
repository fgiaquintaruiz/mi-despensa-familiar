-- FEAT-2 fix: soft-delete via SECURITY DEFINER RPC.
--
-- Contexto: el UPDATE directo desde el cliente fallaba con RLS 42501
-- aunque la sesión, household_id y policies estaban correctos. Causa
-- raíz probable: PostgREST hace implicit SELECT post-UPDATE y la SELECT
-- policy (deleted_at IS NULL) bloquea el row recién marcado como
-- eliminado, lo que Postgres reporta como violación de policy.
--
-- Solución: función SECURITY DEFINER que valida membresía manualmente
-- y ejecuta el UPDATE bypaseando RLS controladamente.

CREATE OR REPLACE FUNCTION public.soft_delete_transaction(t_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.shopping_transactions st
    WHERE st.id = t_id
      AND public.is_household_member(st.household_id)
      AND st.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Transaction not found or not authorized'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.shopping_transactions
  SET deleted_at = NOW()
  WHERE id = t_id;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_transaction(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_transaction(uuid) TO authenticated;
