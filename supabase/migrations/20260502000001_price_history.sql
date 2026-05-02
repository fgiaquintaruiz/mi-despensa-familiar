CREATE TABLE public.price_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price       NUMERIC(10,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_product_id ON public.price_history(product_id);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own price history"
  ON public.price_history FOR SELECT
  USING (
    product_id IN (
      SELECT id FROM public.products WHERE household_id IN (
        SELECT id FROM public.households WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users insert own price history"
  ON public.price_history FOR INSERT
  WITH CHECK (
    product_id IN (
      SELECT id FROM public.products WHERE household_id IN (
        SELECT id FROM public.households WHERE owner_id = auth.uid()
      )
    )
  );
