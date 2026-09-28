import type { LucideIcon } from 'lucide-react';

export function StatTile({ icon: Icon, value, caption, sub }: {
  icon: LucideIcon; value: string | number; caption: string; sub?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-[var(--color-panel)] px-4 py-4 text-center">
      <span className="flex items-center gap-1.5 text-2xl font-extrabold tabular-nums">
        <Icon size={18} className="text-[var(--color-accent)]" /> {value}
      </span>
      <span className="text-[11px] text-[var(--color-subtle)]">{caption}</span>
      {sub && <span className="text-[11px] text-[var(--color-subtle)]">{sub}</span>}
    </div>
  );
}
