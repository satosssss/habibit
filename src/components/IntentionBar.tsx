import type { LucideIcon } from 'lucide-react';
import { nameIcon } from '@/lib/icons';

// `icon` accepts a name (unit usage) or a component (StatsScreen passes the
// Lucide icon returned by intentionIcon).
export function IntentionBar({
  intention, color, icon, completed, scheduled,
}: { intention: string; color: string; icon: string | LucideIcon; completed: number; scheduled: number }) {
  const Icon = typeof icon === 'string' ? nameIcon(icon) : icon;
  const width = scheduled > 0 ? (completed / scheduled) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon size={16} className="shrink-0" style={{ color }} />
      <span className="w-36 shrink-0 truncate text-sm font-semibold">{intention}</span>
      <span className="h-1.5 flex-1 rounded-full bg-[var(--color-muted)]">
        <span data-testid="intention-fill" className="block h-1.5 rounded-full"
              style={{ width: `${width}%`, background: color }} />
      </span>
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-[var(--color-subtle)]">
        {completed}/{scheduled}
      </span>
    </div>
  );
}
