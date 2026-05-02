interface Props {
  total: number;
  lowStock: number;
  categories: number;
}

export default function DashboardStats({ total, lowStock, categories }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="min-h-[2rem] text-xs text-gray-500">Total productos</p>
        <p className="mt-1 text-2xl font-bold">{total}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="min-h-[2rem] text-xs text-gray-500">Stock bajo</p>
        <p className="mt-1 text-2xl font-bold text-orange-500">{lowStock}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="min-h-[2rem] text-xs text-gray-500">Categorías activas</p>
        <p className="mt-1 text-2xl font-bold">{categories}</p>
      </div>
    </div>
  );
}
