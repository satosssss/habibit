'use client';

import { useEffect, useState } from 'react';
import { HABIT_COLORS, intentionColor } from '@/lib/colors';
import { ICON_CHOICES, nameIcon } from '@/lib/icons';
import { intentionSuggestions } from '@/lib/labels';
import type { Habit, HabitType } from '@/lib/types';
import { Combobox } from './Combobox';
import { Sheet } from './Sheet';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const TYPES: HabitType[] = ['boolean', 'quantity', 'timer'];
// Spec §9: "Frequency (Every day / Weekdays / Weekends / weekday toggles)" —
// presets first, then the toggles.
const PRESETS = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
] as const;

export function HabitForm({
  habit, open, categories = [], intentions = [], onSave, onClose,
}: {
  habit: Habit;
  open: boolean;
  categories?: string[];
  intentions?: string[];
  onSave: (h: Habit) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(habit);

  useEffect(() => { setDraft(habit); }, [habit]);

  const set = <K extends keyof Habit>(key: K, value: Habit[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  // The timer target edits in minutes (spec §9) but stores seconds (§4.2):
  // the input round-trips `minutes × 60`, so typing never gets clobbered by
  // the seconds value re-rendering underneath it.
  const save = () => {
    const target =
      draft.type === 'boolean' ? 1
      : draft.type === 'timer' ? Math.max(60, Math.round(Number(draft.target) || 600))
      : Math.max(1, Math.round(Number(draft.target) || 1));
    onSave({ ...draft, name: draft.name.trim() || 'Untitled habit', target });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={habit.name ? 'Edit habit' : 'New habit'}>
      <div className="flex flex-col gap-3">
        <label data-field="name" className="block text-sm">
          <span className="mb-1 block font-semibold">Habit name</span>
          <input id="habit-name" value={draft.name}
                 onChange={(e) => set('name', e.target.value)}
                 className="w-full rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-accent)]" />
        </label>

        {/* Two distinct concepts (spec §4.2): category = time/context, intention = meaning/purpose. */}
        <div data-field="category">
          <Combobox label="Category" value={draft.category} options={categories}
                    listId="habit-category-list" onChange={(v) => set('category', v)} />
        </div>
        <div data-field="intention">
          <Combobox label="Intention" value={draft.intention} options={intentions}
                    listId="habit-intention-list" placeholder="Type your own…"
                    onChange={(v) => set('intention', v)} />
          {/* Spec §7/R5: suggestion chips — the input above remains the custom path. */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {intentionSuggestions(intentions).map((suggestion) => {
              const active = draft.intention.trim().toLowerCase() === suggestion.toLowerCase();
              return (
                <button key={suggestion} type="button" aria-label={suggestion}
                        aria-pressed={active} onClick={() => set('intention', suggestion)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                          active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                                 : 'border-[var(--color-line)]'
                        }`}>
                  {active ? '✓ ' : ''}{suggestion}
                </button>
              );
            })}
          </div>
          <p className="mt-1 flex items-center gap-2 text-xs text-[var(--color-subtle)]">
            <span data-testid="intention-swatch" className="inline-block h-3 w-3 rounded-full"
                  style={{ background: intentionColor(draft.intention) }} />
            Color is derived from the intention name, so it stays consistent everywhere.
          </p>
        </div>

        <fieldset data-field="icon" className="block border-0 p-0 text-sm">
          <legend className="mb-1 block font-semibold">Icon</legend>
          <div className="flex flex-wrap gap-1.5">
            {ICON_CHOICES.map((name) => {
              const Icon = nameIcon(name);
              const active = draft.icon === name;
              return (
                <button key={name} type="button" aria-label={`Icon ${name}`}
                        aria-pressed={active} onClick={() => set('icon', name)}
                        className={`grid h-9 w-9 place-items-center rounded-xl border ${
                          active ? 'border-[var(--color-accent)] bg-[var(--color-muted)]' : 'border-[var(--color-line)]'
                        }`}>
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset data-field="color" className="block border-0 p-0 text-sm">
          <legend className="mb-1 block font-semibold">Color</legend>
          <div className="flex flex-wrap gap-1.5">
            {HABIT_COLORS.map((color) => (
              <button key={color} type="button" aria-label={`Color ${color}`}
                      aria-pressed={draft.color === color} onClick={() => set('color', color)}
                      className={`h-8 w-8 rounded-full border-2 ${
                        draft.color === color ? 'border-[var(--color-fg)]' : 'border-transparent'
                      }`}
                      style={{ background: color }} />
            ))}
          </div>
        </fieldset>

        <fieldset data-field="type" className="block border-0 p-0 text-sm">
          <legend className="mb-1 block font-semibold">Type</legend>
          <div className="flex gap-2">
            {TYPES.map((type) => (
              <button key={type} type="button" aria-label={`Type ${type}`}
                      aria-pressed={draft.type === type}
                      onClick={() => set('type', type)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm capitalize ${
                        draft.type === type
                          ? 'border-[var(--color-accent)] bg-[var(--color-muted)]'
                          : 'border-[var(--color-line)]'
                      }`}>
                {type}
              </button>
            ))}
          </div>
        </fieldset>

        {draft.type !== 'boolean' && (
          <label data-field="target" className="block text-sm">
            <span className="mb-1 block font-semibold">
              Target {draft.type === 'timer' ? '(minutes)' : draft.unit ? `(${draft.unit})` : ''}
            </span>
            <input id="habit-target" type="number" min={1}
                   value={draft.type === 'timer' ? Math.round(draft.target / 60) : draft.target}
                   onChange={(e) => set('target',
                     draft.type === 'timer'
                       ? Math.round(Number(e.target.value)) * 60
                       : Number(e.target.value))}
                   className="w-full rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-accent)]" />
          </label>
        )}

        {draft.type === 'quantity' && (
          <label data-field="unit" className="block text-sm">
            <span className="mb-1 block font-semibold">Unit</span>
            <input id="habit-unit" value={draft.unit} placeholder="cups, calories, minutes…"
                   onChange={(e) => set('unit', e.target.value)}
                   className="w-full rounded-xl border border-[var(--color-line)] bg-transparent px-3 py-2 outline-none focus:border-[var(--color-accent)]" />
          </label>
        )}

        <fieldset data-field="frequency" className="block border-0 p-0 text-sm">
          <legend className="mb-1 block font-semibold">Frequency</legend>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => {
              // Presets are actions; the chips are the state of record. A preset
              // only reports "pressed" while the chip set exactly equals it —
              // toggling any chip afterwards diverges (no sticky/locked state).
              const active = draft.frequency.length === preset.days.length
                && preset.days.every((d) => draft.frequency.includes(d));
              return (
                <button key={preset.label} type="button" aria-label={preset.label}
                        aria-pressed={active} onClick={() => set('frequency', [...preset.days])}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                          active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                                 : 'border-[var(--color-line)]'
                        }`}>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DAYS.map((day, index) => {
              const active = draft.frequency.includes(index);
              return (
                <button key={day} type="button" aria-label={day} aria-pressed={active}
                        onClick={() => set('frequency',
                          active ? draft.frequency.filter((d) => d !== index)
                                 : [...draft.frequency, index].sort((a, b) => a - b))}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                          active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                                 : 'border-[var(--color-line)]'
                        }`}>
                  {day}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button type="button" onClick={save}
                className="mt-1 rounded-2xl bg-[var(--color-accent)] px-4 py-3 font-semibold text-white">
          Save habit
        </button>
      </div>
    </Sheet>
  );
}
