import StatCard from '@/components/StatCard';

interface Props {
  total: number;
  lowStock: number;
  categories: number;
}

export default function DashboardStats({ total, lowStock, categories }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Total productos" value={total} />
      <StatCard label="Stock bajo" value={lowStock} emphasis="orange" />
      <StatCard label="Categorías activas" value={categories} />
    </div>
  );
}
