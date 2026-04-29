interface StatCardProps {
  label:   string;
  value:   string;
  sub?:    string;
  percent?: number;
  icon:    string;
  color?:  'blue' | 'green' | 'yellow' | 'red';
}

const colorMap = {
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
};

export default function StatCard({ label, value, sub, percent, icon, color = 'blue' }: StatCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-400 text-sm">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
      {percent !== undefined && (
        <div className="mt-3 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${colorMap[color]} transition-all`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
