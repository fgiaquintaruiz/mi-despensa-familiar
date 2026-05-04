-- ============================================================
-- mi-despensa-familiar | migration 20260505000000
-- Budget tracking: budgets, shopping_transactions, transaction_items
-- ============================================================

-- ============================================================
-- TABLE: budgets
-- ============================================================
CREATE TABLE public.budgets (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID          NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  period_type     TEXT          NOT NULL CHECK (period_type IN ('monthly', 'biweekly')),
  start_date      DATE          NOT NULL,
  end_date        DATE          NOT NULL,
  is_active       BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT period_valid CHECK (end_date > start_date)
);

CREATE INDEX idx_budgets_household_active
  ON public.budgets(household_id, is_active, start_date DESC);

CREATE TRIGGER budgets_set_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY budgets_select_member
  ON public.budgets FOR SELECT
  USING (public.is_household_member(household_id));

CREATE POLICY budgets_insert_member
  ON public.budgets FOR INSERT
  WITH CHECK (public.is_household_member(household_id));

CREATE POLICY budgets_update_member
  ON public.budgets FOR UPDATE
  USING (public.is_household_member(household_id));

CREATE POLICY budgets_delete_owner
  ON public.budgets FOR DELETE
  USING (public.is_household_owner(household_id));

-- ============================================================
-- TABLE: shopping_transactions
-- ============================================================
CREATE TABLE public.shopping_transactions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     UUID          NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  store_name       TEXT,
  total_amount     NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  item_count       INTEGER       NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  transaction_date DATE          NOT NULL DEFAULT CURRENT_DATE,
  source           TEXT          NOT NULL DEFAULT 'ocr' CHECK (source IN ('ocr', 'manual')),
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_household_date
  ON public.shopping_transactions(household_id, transaction_date DESC);

-- RLS
ALTER TABLE public.shopping_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_select_member
  ON public.shopping_transactions FOR SELECT
  USING (public.is_household_member(household_id));

CREATE POLICY transactions_insert_member
  ON public.shopping_transactions FOR INSERT
  WITH CHECK (public.is_household_member(household_id));

-- No UPDATE/DELETE in MVP: transactions are immutable from the user's perspective

-- ============================================================
-- TABLE: transaction_items
-- ============================================================
CREATE TABLE public.transaction_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID          NOT NULL REFERENCES public.shopping_transactions(id) ON DELETE CASCADE,
  product_id      UUID          REFERENCES public.products(id) ON DELETE SET NULL,
  product_name    TEXT          NOT NULL,
  quantity        NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total      NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_items_transaction
  ON public.transaction_items(transaction_id);

CREATE INDEX idx_transaction_items_product
  ON public.transaction_items(product_id)
  WHERE product_id IS NOT NULL;

-- RLS via parent transaction
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_select_via_transaction
  ON public.transaction_items FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM public.shopping_transactions
      WHERE public.is_household_member(household_id)
    )
  );

CREATE POLICY items_insert_via_transaction
  ON public.transaction_items FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.shopping_transactions
      WHERE public.is_household_member(household_id)
    )
  );

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON public.budgets, public.shopping_transactions, public.transaction_items
  TO authenticated;

-- ============================================================
-- DOWN SCRIPT (rollback — run manually if needed)
-- DROP TABLE IF EXISTS public.transaction_items;
-- DROP TABLE IF EXISTS public.shopping_transactions;
-- DROP TABLE IF EXISTS public.budgets;
-- ============================================================
