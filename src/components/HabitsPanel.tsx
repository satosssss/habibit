'use client';

import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { deleteHabit, listHabits, newId, putHabit } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { Habit } from '@/lib/types';
import { HabitForm } from './HabitForm';
import { HabitList } from './HabitList';

// Shared draft for a brand-new habit: Settings' `+ New habit` and the Today
// header's `+` both open the form with this.
export const blankHabit = (): Habit => ({
  id: newId(), name: '', icon: 'target', color: '#6366f1', category: 'Morning',
  intention: '', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: Date.now(),
});

export function HabitsPanel() {
  const habits = useLiveQuery(() => listHabits(), []);
  const [editing, setEditing] = useState<Habit | null>(null);

  const categories = useMemo(
    () => [...new Set((habits ?? []).map((h) => h.category))].sort(),
    [habits],
  );
  const intentions = useMemo(
    () => [...new Set((habits ?? []).map((h) => h.intention).filter(Boolean))].sort(),
    [habits],
  );

  const save = useCallback(async (habit: Habit) => {
    await putHabit(habit);
    setEditing(null);
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Habits</h2>
        <button type="button" onClick={() => setEditing(blankHabit())}
                className="flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-white">
          <Plus size={15} /> New habit
        </button>
      </div>

      <HabitList
        habits={habits ?? []}
        onEdit={(id) => setEditing((habits ?? []).find((h) => h.id === id) ?? null)}
        onDelete={(id) => void deleteHabit(id)}
        onReorder={(next) => { for (const habit of next) void putHabit(habit); }}
      />

      {editing && (
        <HabitForm
          habit={editing} open categories={categories} intentions={intentions}
          onSave={(h) => void save(h)} onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
