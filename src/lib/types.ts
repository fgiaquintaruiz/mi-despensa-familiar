// ============================================================
// Database types — aligned to supabase/migrations/0001_initial.sql
// snake_case matches Supabase JS client serialization (no mapper needed)
// ============================================================

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------

export const CATEGORIES = [
  { key: 'despensa', label: 'Despensa', emoji: '🍞' },
  { key: 'higiene', label: 'Higiene', emoji: '🧴' },
  { key: 'bebe', label: 'Bebé/Niñas', emoji: '👶' },
  { key: 'limpieza', label: 'Limpieza', emoji: '🧹' },
  { key: 'frescos', label: 'Frescos', emoji: '🥛' },
  { key: 'farmacia', label: 'Farmacia', emoji: '💊' },
] as const;

export type Category = (typeof CATEGORIES)[number]['key'];

const _categoryMap = new Map(CATEGORIES.map((c) => [c.key, c]));

export function categoryLabel(key: Category): string {
  return _categoryMap.get(key)!.label;
}

export function categoryEmoji(key: Category): string {
  return _categoryMap.get(key)!.emoji;
}

export function isLowStock(product: Pick<Product, 'min_stock' | 'current_stock'>): boolean {
  return product.min_stock > 0 && product.current_stock < product.min_stock;
}

// ------------------------------------------------------------
// Role
// ------------------------------------------------------------

export type HouseholdRole = 'owner' | 'member';

// ------------------------------------------------------------
// Row types (SELECT — what Supabase returns)
// timestamptz columns are serialized as ISO 8601 strings by supabase-js
// nullable columns use `| null`, not `?:` (Supabase returns null, not undefined)
// ------------------------------------------------------------

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  created_at: string;
}

export interface Product {
  id: string;
  household_id: string;
  name: string;
  brand: string | null;
  category: Category;
  unit: string | null;
  current_stock: number;
  min_stock: number;
  price: number;
  barcode: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsumptionLog {
  id: string;
  product_id: string;
  qty: number;
  date: string;
  type: 'restock' | null;
  created_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  product_id: string;
  price: number;
  recorded_at: string;
}

// ------------------------------------------------------------
// Insert types (what you send on INSERT)
// Fields with SQL defaults are optional: id, *_at, current_stock, min_stock, price
// ------------------------------------------------------------

export interface HouseholdInsert {
  id?: string;
  name: string;
  created_at?: string;
}

export interface HouseholdMemberInsert {
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  created_at?: string;
}

export interface ProductInsert {
  id?: string;
  household_id: string;
  name: string;
  brand?: string | null;
  category: Category;
  unit?: string | null;
  current_stock?: number;
  min_stock?: number;
  price?: number;
  barcode?: string | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ConsumptionLogInsert {
  id?: string;
  product_id: string;
  qty: number;
  date?: string;
  type?: 'restock' | null;
  created_at?: string;
}

export interface PriceHistoryInsert {
  id?: string;
  product_id: string;
  price: number;
  recorded_at?: string;
}

// ------------------------------------------------------------
// Update types (what you send on UPDATE — all optional, no id)
// ------------------------------------------------------------

export type HouseholdUpdate = Partial<Omit<HouseholdInsert, 'id'>>;
export type HouseholdMemberUpdate = Partial<Omit<HouseholdMemberInsert, 'household_id' | 'user_id'>>;
export type ProductUpdate = Partial<Omit<ProductInsert, 'id'>>;
export type ConsumptionLogUpdate = Partial<Omit<ConsumptionLogInsert, 'id'>>;
export type PriceHistoryUpdate = Partial<Omit<PriceHistoryInsert, 'id'>>;

// ------------------------------------------------------------
// Budget & Shopping Transaction types
// Added in: budget-supermercado feature
// ------------------------------------------------------------

// --- Row types (SELECT) ---

export type BudgetPeriodType = 'monthly' | 'biweekly';
export type BudgetCurrency = 'EUR' | 'USD' | 'ARS';

export interface Budget {
  id: string;
  household_id: string;
  amount: number;
  period_type: BudgetPeriodType;
  start_date: string;   // ISO date string "YYYY-MM-DD"
  end_date: string;     // ISO date string "YYYY-MM-DD"
  is_active: boolean;
  currency: BudgetCurrency;
  created_at: string;
  updated_at: string;
}

export interface ShoppingTransaction {
  id: string;
  household_id: string;
  store_name: string | null;
  total_amount: number;
  item_count: number;
  transaction_date: string; // "YYYY-MM-DD"
  source: 'ocr' | 'manual';
  notes: string | null;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

// --- Computed type (NOT a DB row) ---
export interface BudgetSummary {
  budget: Budget;
  spent: number;           // SUM(total_amount) of transactions in the active period
  remaining: number;       // budget.amount - spent
  percentage: number;      // (spent / budget.amount) * 100, clamped 0-100
  transactionCount: number;
  currency: BudgetCurrency;
  manual_amount: number;   // SUM of transactions with source='manual' in the period
  auto_amount: number;     // SUM of transactions with source='ocr' in the period
  has_manual: boolean;     // true if manual_amount > 0
  transactions: ShoppingTransaction[]; // full list for the active period (no extra DB call)
}

// --- Insert types ---
export interface BudgetInsert {
  id?: string;
  household_id: string;
  amount: number;
  period_type: BudgetPeriodType;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  currency?: BudgetCurrency;
  created_at?: string;
  updated_at?: string;
}

export interface ShoppingTransactionInsert {
  id?: string;
  household_id: string;
  store_name?: string | null;
  total_amount: number;
  item_count?: number;
  transaction_date?: string;
  source?: 'ocr' | 'manual';
  notes?: string | null;
  created_at?: string;
}

export interface TransactionItemInsert {
  id?: string;
  transaction_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at?: string;
}

// --- Update types ---
export type BudgetUpdate = Partial<Omit<BudgetInsert, 'id' | 'household_id'>>;

// ShoppingTransaction and TransactionItem are immutable in MVP — no Update types.

// ------------------------------------------------------------
// Database shape — compatible with createClient<Database>()
// Matches the shape produced by `supabase gen types typescript`
// ------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      households: { Row: Household; Insert: HouseholdInsert; Update: HouseholdUpdate };
      household_members: { Row: HouseholdMember; Insert: HouseholdMemberInsert; Update: HouseholdMemberUpdate };
      products: { Row: Product; Insert: ProductInsert; Update: ProductUpdate };
      consumption_logs: { Row: ConsumptionLog; Insert: ConsumptionLogInsert; Update: ConsumptionLogUpdate };
      price_history: { Row: PriceHistoryEntry; Insert: PriceHistoryInsert; Update: PriceHistoryUpdate };
      budgets: { Row: Budget; Insert: BudgetInsert; Update: BudgetUpdate };
      shopping_transactions: { Row: ShoppingTransaction; Insert: ShoppingTransactionInsert; Update: never };
      transaction_items: { Row: TransactionItem; Insert: TransactionItemInsert; Update: never };
    };
  };
};
