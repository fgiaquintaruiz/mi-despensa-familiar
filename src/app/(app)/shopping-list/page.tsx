import { createClient } from '@/lib/supabase/server';
import { CATEGORIES } from '@/lib/types';
import ShareButton from '../_components/ShareButton';
import { calculateShoppingList } from '@/lib/shopping-list';
import { PageHeader } from '../_components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function ShoppingListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user!.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const householdId = membership.household_id;

  // 1. Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('household_id', householdId);

  if (!products) return null;

  // 2. Fetch logs last 30 days (consumption only, type is null)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: logs } = await supabase
    .from('consumption_logs')
    .select('*')
    .in(
      'product_id',
      products.map((p) => p.id),
    )
    .gte('date', thirtyDaysAgo.toISOString())
    .is('type', null);

  // 3. Calculation logic (delegated to helper)
  const itemsToBuy = calculateShoppingList(products, logs || []);

  // 4. Group by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: itemsToBuy.filter((item) => item.category === cat.key),
  })).filter((g) => g.items.length > 0);

  const totalEstimated = itemsToBuy.reduce((sum, item) => sum + item.estimated_price, 0);

  // Prepare plain text for sharing
  const shareText = grouped
    .map((g) => {
      const items = g.items
        .map((i) => `- ${i.name}: ${i.qty_to_buy} ${i.unit || 'uds'}`)
        .join('\n');
      return `${g.emoji} ${g.label}\n${items}`;
    })
    .join('\n\n');

  return (
    <main className="mx-auto max-w-[480px] px-5 py-8 pb-32">
      <PageHeader
        breadcrumbs={[{ label: 'Mi Despensa', href: '/' }]}
        title="Lista de Compra"
      />

      {grouped.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">¡Tu despensa está al día! No necesitas comprar nada.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <span>{group.emoji}</span> {group.label}
              </h2>
              <div className="overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]">
                {group.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 ${
                      idx !== group.items.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div>
                      <div className="font-bold">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.brand || ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[var(--color-brand)]">
                        {item.qty_to_buy} {item.unit || 'uds'}
                      </div>
                      <div className="text-xs text-gray-400">~{item.estimated_price.toFixed(2)}€</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-[var(--radius-card)] bg-[var(--color-brand)] p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Total Estimado</span>
              <span className="text-2xl font-extrabold">{totalEstimated.toFixed(2)}€</span>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-8 left-1/2 w-full max-w-[440px] -translate-x-1/2 px-5">
        <ShareButton text={shareText} />
      </div>
    </main>
  );
}
