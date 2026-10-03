'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { listHabits, newId, putHabit } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';
import { reportWriteError } from '@/lib/writeError';
import { nameIcon } from '@/lib/icons';
import type { Habit } from '@/lib/types';
import { TEMPLATE_GROUPS, type TemplateGroup, type TemplateHabit } from '@/lib/templates';
import { blankHabit } from './HabitsPanel';
import { HabitForm } from './HabitForm';

export function AddHabitScreen() {
  const router = useRouter();
  const habits = useLiveQuery(() => listHabits(), []);
  const [groupKey, setGroupKey] = useState<TemplateGroup['key']>('good');
  const [editing, setEditing] = useState<Habit | null>(null);

  // Combobox suggestion pools: existing values first, group labels always offered
  // so a pre-filled category/intention is a valid choice (spec R4).
  const categories = useMemo(
    () => [...new Set([
      ...(habits ?? []).map((h) => h.category),
      ...TEMPLATE_GROUPS.map((g) => g.label),
    ])].sort(),
    [habits],
  );
  const intentions = useMemo(
    () => [...new Set((habits ?? []).map((h) => h.intention).filter(Boolean))].sort(),
    [habits],
  );

  const group = TEMPLATE_GROUPS.find((g) => g.key === groupKey) ?? TEMPLATE_GROUPS[0];

  const openTemplate = (t: TemplateHabit) => setEditing({
    id: newId(), name: t.name, icon: t.icon, color: t.color, category: t.category,
    intention: t.intention, type: t.type, target: t.target, unit: t.unit,
    frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: Date.now(),
  });

  const save = async (habit: Habit) => {
    try {
      await putHabit(habit);
      setEditing(null);
      router.push('/habits');            // land where the new habit is listed (spec R4)
    } catch (err) { reportWriteError(err); }   // banner only; never navigate on a failed write
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <h1 className="py-4 text-lg font-extrabold">Add habit</h1>

      <div role="group" aria-label="Template groups" className="mb-4 flex flex-wrap gap-1.5">
        {TEMPLATE_GROUPS.map((g) => (
          <button
            key={g.key} type="button" aria-pressed={g.key === group.key}
            onClick={() => setGroupKey(g.key)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              g.key === group.key
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                : 'text-[var(--color-subtle)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {group.habits.map((t) => {
          const Icon = nameIcon(t.icon);
          return (
            <li key={t.name}>
              <button
                type="button" onClick={() => openTemplate(t)}
                className="glass-card flex min-h-16 w-full flex-col items-center gap-2 p-4 text-center transition-colors hover:bg-[var(--color-muted)]"
              >
                <Icon size={22} style={{ color: t.color }} aria-hidden />
                <span className="text-sm font-semibold">{t.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button" onClick={() => setEditing(blankHabit())}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-line)] px-4 py-4 text-sm font-semibold text-[var(--color-subtle)] transition-colors hover:text-[var(--color-fg)]"
      >
        Start from scratch
      </button>

      {editing && (
        <HabitForm
          habit={editing} open categories={categories} intentions={intentions}
          onSave={(h) => void save(h)} onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
