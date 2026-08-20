import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent?: boolean;
}

export function StatCard({ icon: Icon, label, value, accent }: StatCardProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-card p-4 ${
        accent
          ? 'border border-neon/20 bg-neon/5'
          : 'bg-white/[0.03] border border-white/[0.06]'
      }`}
    >
      <Icon
        size={20}
        className={accent ? 'text-neon' : 'text-ash'}
      />
      <span className="font-display text-xl font-black text-paper">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-ash">
        {label}
      </span>
    </div>
  );
}
