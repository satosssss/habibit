'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId } from 'react';
import { categoryIcon } from '@/lib/icons';
import type { Habit } from '@/lib/types';
import { useReveal } from '@/lib/useReveal';
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
  const listId = useId();
  const revealRef = useReveal<HTMLElement>();
  const ordered = [...habits].sort((a, b) => a.order - b.order);

  return (
    // mb-3 = vertical rhythm (a multicol gap can't space stacked blocks);
    // break-inside-avoid keeps a panel whole inside its column; reveal enters
    // via useReveal (immediate fallback where IntersectionObserver is absent).
    <section ref={revealRef} className="mb-3 break-inside-avoid glass-card reveal p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
          <Icon size={16} /> {category}
        </h2>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${category}`}
          // Only while expanded: the <ul> exists only then — a dangling
          // idref would fail axe (spec R5).
          aria-controls={collapsed ? undefined : listId}
          onClick={onToggleCollapse}
          className="grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--color-accent-ink)] text-[var(--color-accent-ink)]"
        >
          {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {!collapsed && (
        <ul id={listId} className="flex flex-col gap-2">
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
