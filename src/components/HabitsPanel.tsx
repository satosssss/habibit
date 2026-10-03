'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { deleteHabit, listHabits, newId, putHabit, putHabits } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';
import { reportWriteError } from '@/lib/writeError';
import type { Habit } from '@/lib/types';
import { HabitForm } from './HabitForm';
import { HabitList } from './HabitList';

// Shared draft for a brand-new habit: the /add-habit scratch flow seeds the
// form with this.
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
    try {
      await putHabit(habit);
      setEditing(null);
    } catch (err) { reportWriteError(err); }         // form stays open on failure
  }, []);

  return (
    <section className="glass-card mb-6 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Habits</h2>
        <Link href="/add-habit"
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-accent)] px-3 py-2.5 text-sm font-semibold text-[var(--color-on-accent)]">
          <Plus size={15} /> New habit
        </Link>
      </div>

      {habits === undefined ? (
        <p className="skeleton p-6 text-center text-sm text-[var(--color-subtle)]">Loading…</p>
      ) : habits.length === 0 ? (
        <Link href="/add-habit" className="block p-6 text-center text-sm text-[var(--color-subtle)]">
          No habits yet — create one.
        </Link>
      ) : (
        <HabitList
          habits={habits}
          onEdit={(id) => setEditing(habits.find((h) => h.id === id) ?? null)}
          onDelete={(id) => void deleteHabit(id).catch(reportWriteError)}
          onReorder={(next) => { void putHabits(next).catch(reportWriteError); }}
        />
      )}

      {editing && (
        <HabitForm
          habit={editing} open categories={categories} intentions={intentions}
          onSave={(h) => void save(h)} onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
