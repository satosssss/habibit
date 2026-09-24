'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { categoryIcon } from '@/lib/icons';
import type { Habit } from '@/lib/types';
import { HabitRow } from './HabitRow';

export interface CategorySectionProps {
  category: string;
  habits: Habit[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  values: Record<string, number>;
  streaks: Record<string, number>;
  onToggle: (habit: Habit) => void;
  onStep: (habit: Habit, delta: number) => void;
  onOpenTimer: (habit: Habit) => void;
  onOpenValue: (habit: Habit) => void;
}

export function CategorySection({
  category, habits, collapsed, onToggleCollapse, values, streaks,
  onToggle, onStep, onOpenTimer, onOpenValue,
}: CategorySectionProps) {
  const Icon = categoryIcon(category);
  const ordered = [...habits].sort((a, b) => a.order - b.order);

  return (
    <section className="rounded-3xl bg-[var(--color-panel)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
          <Icon size={16} /> {category}
        </h2>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${category}`}
          onClick={onToggleCollapse}
          className="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--color-accent)] text-[var(--color-accent)]"
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {!collapsed && (
        <ul className="flex flex-col gap-2">
          {ordered.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              value={values[habit.id] ?? 0}
              streak={streaks[habit.id] ?? 0}
              onToggle={() => onToggle(habit)}
              onStep={(delta) => onStep(habit, delta)}
              onOpenTimer={() => onOpenTimer(habit)}
              onOpenValue={() => onOpenValue(habit)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
