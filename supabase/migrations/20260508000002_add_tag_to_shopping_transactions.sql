-- FEAT-3 Fase A: añadir tag al ticket para diferenciar promedios.
--
-- Contexto: el "ticket promedio" agregado mezcla compras grandes (mensual: 300€)
-- con reposiciones chicas (diaria: 15€) y produce un número inútil. Taggear cada
-- ticket permite calcular promedios separados por tipo de compra.
--
-- Dominio fijo v1: 'mensual' | 'semanal' | 'diaria' | 'imprevisto'.
-- NULL queda permitido para retro-compatibilidad con tickets pre-migration.

ALTER TABLE public.shopping_transactions
ADD COLUMN tag TEXT DEFAULT NULL;

ALTER TABLE public.shopping_transactions
ADD CONSTRAINT shopping_transactions_tag_check
CHECK (tag IS NULL OR tag IN ('mensual', 'semanal', 'diaria', 'imprevisto'));

COMMENT ON COLUMN public.shopping_transactions.tag IS
  'Tipo de compra para segmentar el promedio. Dominio fijo: mensual | semanal | diaria | imprevisto. NULL para tickets anteriores a FEAT-3.';
