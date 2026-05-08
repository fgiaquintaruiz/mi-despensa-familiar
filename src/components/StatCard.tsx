interface Props {
  label: string;
  value: string | number;
  emphasis?: 'orange' | 'red';
}

const emphasisClass: Record<NonNullable<Props['emphasis']>, string> = {
  orange: 'text-orange-500',
  red: 'text-red-500',
};

export default function StatCard({ label, value, emphasis }: Props) {
  const valueClass = emphasis
    ? `mt-1 text-2xl font-bold ${emphasisClass[emphasis]}`
    : 'mt-1 text-2xl font-bold';

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="min-h-[2rem] text-xs text-gray-500">{label}</p>
      <p className={valueClass}>{value}</p>
    </div>
  );
}
