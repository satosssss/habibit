'use client';

import { useEffect, useState } from 'react';
import { HABIT_COLORS, intentionColor } from '@/lib/colors';
import { ICON_CHOICES, nameIcon } from '@/lib/icons';
import { intentionSuggestions } from '@/lib/labels';
import { DIFFICULTIES, type Habit, type HabitType } from '@/lib/types';
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

// Add-habit design: stored reminder time is 'HH:MM' (24h), empty = none.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Add-habit design: the form materialises both detail fields, so every save
// writes a complete record — legacy habits (seeded/imported) migrate on their
// first edit, and the silent blank-name default is replaced by validation.
const withDefaults = (h: Habit): Habit => ({
  ...h,
  difficulty: h.difficulty ?? 'medium',
  reminderTime: h.reminderTime ?? '',
});

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
  const [draft, setDraft] = useState(() => withDefaults(habit));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { setDraft(withDefaults(habit)); }, [habit]);

  const set = <K extends keyof Habit>(key: K, value: Habit[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors({});
  };

  // Spec R5: a type switch converts timer↔quantity targets and never
  // otherwise destroys the draft number (boolean coercion happens at save).
  const switchType = (next: HabitType) => {
    if (next === draft.type) return;
    let target = draft.target;
    if (draft.type === 'timer' && next === 'quantity') target = Math.max(1, Math.round(draft.target / 60));
    else if (draft.type === 'quantity' && next === 'timer') target = Math.max(60, Math.round(draft.target * 60));
    setDraft((prev) => ({ ...prev, type: next, target }));
    setErrors({});
  };

  // The timer target edits in minutes (spec §9) but stores seconds (§4.2):
  // the input round-trips `minutes × 60`, so typing never gets clobbered by
  // the seconds value re-rendering underneath it.
  const save = () => {
    // Validate what the field SHOWS: the timer input edits minutes
    // (round-trip), the quantity input edits the raw number. A timer whose
    // draft is 30 s displays "1" → valid, saved through the existing 60 s
    // floor (spec §4 "empty/invalid": only an empty/zero display blocks —
    // the old silent 600 fallback is what dies, not the sub-minute floor).
    const shown = draft.type === 'timer' ? Math.round(draft.target / 60) : Number(draft.target);
    const next: Record<string, string> = {};
    if (!draft.name.trim()) next.name = 'Enter a name.';              // add-habit: no silent default
    if (!draft.category.trim()) next.category = 'Choose a category.';
    if (!draft.intention.trim()) next.intention = 'Choose an intention.';
    if (draft.frequency.length === 0) next.frequency = 'Pick at least one day.';
    if (draft.type !== 'boolean' && !(shown >= 1)) next.target = 'Enter a target.';
    if (draft.reminderTime && !TIME_PATTERN.test(draft.reminderTime)) next.reminderTime = 'Enter a valid time.';
    if (Object.values(next).some(Boolean)) { setErrors(next); return; }   // stay open, nothing saved
    setErrors({});
    const target =
      draft.type === 'boolean' ? 1
      : draft.type === 'timer' ? Math.max(60, Math.round(Number(draft.target)))
      : Math.max(1, Math.round(Number(draft.target)));
    onSave({
      ...draft,
      name: draft.name.trim(),
      category: draft.category.trim(),
      intention: draft.intention.trim(),
      target,
    });
    onClose();
  };

  const sectionClass = 'block border-0 p-0';
  const legendClass = 'mb-2 block w-full text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]';

  return (
    <Sheet open={open} onClose={onClose} title={habit.name ? 'Edit habit' : 'New habit'}>
      {/* noValidate: R5 owns validation with inline role=alert copy — native
          bubbles would block the submit (value 0 < min 1) before save() could
          show them (same jsdom/browser fact as the ValueSheet ruling, T2). */}
      <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-4">
        {/* Add-habit design: four labelled sections. Explicit aria-labelledby
            keeps each group's accessible name deterministic (nested legends). */}
        <fieldset aria-labelledby="section-identity" className={sectionClass}>
          <legend id="section-identity" className={legendClass}>Identity</legend>
          <div className="flex flex-col gap-3">
            <label data-field="name" className="block text-sm">
              <span className="mb-1 block font-semibold">Habit name</span>
              <input id="habit-name" value={draft.name}
                     onChange={(e) => set('name', e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
                     className="glass-input" />
            </label>
            {errors.name && <p role="alert" className="text-xs text-red-500">{errors.name}</p>}

            {/* Two distinct concepts (spec §4.2): category = time/context, intention = meaning/purpose. */}
            <div data-field="category">
              <Combobox label="Category" value={draft.category} options={categories}
                        listId="habit-category-list" onChange={(v) => set('category', v)} />
            </div>
            {errors.category && <p role="alert" className="text-xs text-red-500">{errors.category}</p>}
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
                              active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
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
            {errors.intention && <p role="alert" className="text-xs text-red-500">{errors.intention}</p>}
          </div>
        </fieldset>

        <fieldset aria-labelledby="section-look" className={sectionClass}>
          <legend id="section-look" className={legendClass}>Look</legend>
          <div className="flex flex-col gap-3">
            <fieldset data-field="icon" className="block border-0 p-0 text-sm">
              <legend className="mb-1 block font-semibold">Icon</legend>
              <div className="flex flex-wrap gap-1.5">
                {ICON_CHOICES.map((name) => {
                  const Icon = nameIcon(name);
                  const active = draft.icon === name;
                  return (
                    <button key={name} type="button" aria-label={`Icon ${name}`}
                            aria-pressed={active} onClick={() => set('icon', name)}
                            className={`grid h-10 w-10 place-items-center rounded-xl border ${
                              active ? 'border-[var(--color-accent)] bg-[var(--color-muted)]' : 'border-[var(--color-line)]'
                            }`}>
                      <Icon size={16} aria-hidden />
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
                          className={`h-10 w-10 rounded-full border-2 ${
                            draft.color === color ? 'border-[var(--color-fg)]' : 'border-transparent'
                          }`}
                          style={{ background: color }} />
                ))}
              </div>
            </fieldset>
          </div>
        </fieldset>

        <fieldset aria-labelledby="section-schedule" className={sectionClass}>
          <legend id="section-schedule" className={legendClass}>Schedule</legend>
          <div className="flex flex-col gap-3">
            <fieldset data-field="type" className="block border-0 p-0 text-sm">
              <legend className="mb-1 block font-semibold">Type</legend>
              <div className="flex gap-2">
                {TYPES.map((type) => (
                  <button key={type} type="button" aria-label={`Type ${type}`}
                          aria-pressed={draft.type === type}
                          onClick={() => switchType(type)}
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
              <>
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
                         className="glass-input" />
                </label>
                {errors.target && <p role="alert" className="text-xs text-red-500">{errors.target}</p>}
              </>
            )}

            {draft.type === 'quantity' && (
              <label data-field="unit" className="block text-sm">
                <span className="mb-1 block font-semibold">Unit</span>
                <input id="habit-unit" value={draft.unit} placeholder="cups, calories, minutes…"
                       onChange={(e) => set('unit', e.target.value)}
                       className="glass-input" />
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
                              active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
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
                              active ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                                     : 'border-[var(--color-line)]'
                            }`}>
                      {day}
                    </button>
                  );
                })}
              </div>
              {errors.frequency && <p role="alert" className="text-xs text-red-500">{errors.frequency}</p>}
            </fieldset>
          </div>
        </fieldset>

        <fieldset aria-labelledby="section-details" className={sectionClass}>
          <legend id="section-details" className={legendClass}>Details</legend>
          <div className="flex flex-col gap-3">
            <label data-field="reminder-time" className="block text-sm">
              <span className="mb-1 block font-semibold">Preferred reminder time</span>
              <input id="habit-reminder-time" type="time"
                     value={draft.reminderTime ?? ''}
                     onChange={(e) => set('reminderTime', e.target.value)}
                     className="glass-input" />
            </label>
            {errors.reminderTime && <p role="alert" className="text-xs text-red-500">{errors.reminderTime}</p>}

            <fieldset data-field="difficulty" className="block border-0 p-0 text-sm">
              <legend className="mb-1 block font-semibold">Difficulty</legend>
              <div className="flex gap-2">
                {DIFFICULTIES.map((level) => (
                  <button key={level} type="button" aria-label={`Difficulty ${level}`}
                          aria-pressed={draft.difficulty === level}
                          onClick={() => set('difficulty', level)}
                          className={`flex-1 rounded-xl border px-3 py-2.5 text-sm capitalize ${
                            draft.difficulty === level
                              ? 'border-[var(--color-accent)] bg-[var(--color-muted)]'
                              : 'border-[var(--color-line)]'
                          }`}>
                    {level}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </fieldset>

        <button type="submit"
                className="mt-1 btn-primary">
          Save habit
        </button>
      </form>
    </Sheet>
  );
}
