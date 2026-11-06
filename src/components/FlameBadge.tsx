import { Flame } from 'lucide-react';

export function FlameBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span data-testid="flame-badge"
          className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${className}`}>
      <Flame size={12} className="text-[var(--color-accent)]" fill="currentColor" aria-hidden />
      {count}
    </span>
  );
}
