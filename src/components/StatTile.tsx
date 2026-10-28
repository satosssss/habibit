import type { LucideIcon } from 'lucide-react';
import { useReveal } from '@/lib/useReveal';

export function StatTile({ icon: Icon, value, caption, sub }: {
  icon: LucideIcon; value: string | number; caption: string; sub?: string;
}) {
  const revealRef = useReveal<HTMLDivElement>();
  return (
    <div ref={revealRef} className="glass-card reveal flex flex-col items-center gap-0.5 px-4 py-4 text-center">
      <span className="flex items-center gap-1.5 font-display text-2xl font-extrabold tabular-nums">
        <Icon size={18} className="text-[var(--color-accent)]" aria-hidden /> {value}
      </span>
      <span className="text-[11px] text-[var(--color-subtle)]">{caption}</span>
      {sub && <span className="text-[11px] text-[var(--color-subtle)]">{sub}</span>}
    </div>
  );
}
