'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const BRAND = '#FF6B35';
const BRAND_2 = '#F7931E';

const PIE_COLORS = [
  '#FF6B35',
  '#F7931E',
  '#FFB347',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
];

interface TopProduct {
  name: string;
  total: number;
}

interface CategoryStat {
  category: string;
  total: number;
}

interface Props {
  topProducts: TopProduct[];
  byCategory: CategoryStat[];
}

export default function StatsCharts({ topProducts, byCategory }: Props) {
  return (
    <div className="space-y-8">
      {/* Top 5 más consumidos */}
      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-base font-bold text-[var(--color-foreground)]">
          Top 5 más consumidos
        </h2>
        {topProducts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Sin datos de consumo aún</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={topProducts}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: '#FFF0E6' }}
              />
              <Bar dataKey="total" name="Consumido" fill={BRAND} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Consumo por categoría */}
      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-base font-bold text-[var(--color-foreground)]">
          Consumo por categoría
        </h2>
        {byCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Sin datos de consumo aún</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {byCategory.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(value) => [value ?? 0, 'Consumido']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
