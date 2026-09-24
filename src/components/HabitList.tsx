'use client';

import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { categoryIcon, nameIcon } from '@/lib/icons';
import { frequencyLabel } from '@/lib/labels';
import type { Habit } from '@/lib/types';

export function HabitList({
  habits, onEdit, onDelete, onReorder,
}: {
  habits: Habit[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (habits: Habit[]) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const categories = [...new Set(habits.map((h) => h.category))].sort();

  const drop = (target: Habit) => {
    if (!dragId || dragId === target.id) return;
    const source = habits.find((h) => h.id === dragId);
    if (!source || source.category !== target.category) return;   // reorder within a category only
    const siblings = habits.filter((h) => h.category === target.category)
      .sort((a, b) => a.order - b.order);
    const from = siblings.findIndex((h) => h.id === dragId);
    const to = siblings.findIndex((h) => h.id === target.id);
    const next = [...siblings];
    next.splice(to, 0, next.splice(from, 1)[0]);
    const reordered = next.map((h, index) => ({ ...h, order: index }));
    onReorder([
      ...habits.filter((h) => h.category !== target.category),
      ...reordered,
    ]);
    setDragId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => {
        const Icon = categoryIcon(category);
        const list = habits.filter((h) => h.category === category).sort((a, b) => a.order - b.order);
        return (
          <section key={category}>
            <h3 className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
              <Icon size={14} /> {category}
            </h3>
            <ul className="flex flex-col gap-2">
              {list.map((habit) => {
                const HabitIcon = nameIcon(habit.icon);
                return (
                  <li key={habit.id} data-testid={`habit-row-${habit.id}`} draggable
                      onDragStart={() => setDragId(habit.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => drop(habit)}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2.5">
                    <GripVertical size={16} className="cursor-grab text-[var(--color-subtle)]" />
                    <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: habit.color }}>
                      <HabitIcon size={16} color="#fff" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{habit.name}</p>
                      <p className="truncate text-xs text-[var(--color-subtle)]">
                        {habit.intention} · {frequencyLabel(habit.frequency)}
                      </p>
                    </div>
                    <button type="button" aria-label={`Edit ${habit.name}`} onClick={() => onEdit(habit.id)}
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--color-muted)]">
                      <Pencil size={15} />
                    </button>
                    <button type="button" aria-label={`Delete ${habit.name}`} onClick={() => setPendingDelete(habit.id)}
                            className="grid h-8 w-8 place-items-center rounded-full text-red-500 hover:bg-red-500/10">
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {pendingDelete && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="mb-2 font-semibold">
            Delete “{habits.find((h) => h.id === pendingDelete)?.name}” and all of its history?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPendingDelete(null)}
                    className="rounded-xl border border-[var(--color-line)] px-3 py-1.5">Cancel</button>
            <button type="button" onClick={() => { onDelete(pendingDelete); setPendingDelete(null); }}
                    className="rounded-xl bg-red-600 px-3 py-1.5 font-semibold text-white">Yes, delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
