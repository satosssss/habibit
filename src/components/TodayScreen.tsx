'use client';

import { Flame, Menu, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, classifyDate, formatLong, todayKey } from '@/lib/dates';
import { loadRange, listHabits, putEntry, putHabit } from '@/lib/repo';
import { buildDayStats, currentStreak } from '@/lib/stats';
import { habitStreaks } from '@/lib/streaks';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { Habit } from '@/lib/types';
import { CategorySection } from './CategorySection';
import { DateStrip } from './DateStrip';
import { HabitForm } from './HabitForm';
import { blankHabit } from './HabitsPanel';
import { MenuDrawer } from './MenuDrawer';
import { TimerModal } from './TimerModal';
import { ValueSheet } from './ValueSheet';

const STORE_KEY = 'habibit:collapsed';
const readCollapsed = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { return {}; }
};

// `date` defaults to the current day at render time so the statically
// prerendered /today route never freezes on the build date.
export function TodayScreen({ date = todayKey() }: { date?: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [valueSheet, setValueSheet] = useState<Habit | null>(null);
  const [timerHabit, setTimerHabit] = useState<Habit | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState<Habit | null>(null);
  const timerBeat = useRef<number | null>(null);
  const router = useRouter();
  const today = todayKey();

  // One-time client hydration of the collapse state (localStorage is not SSR-safe).
  useEffect(() => { setCollapsed(readCollapsed()); }, []);

  const closeTimer = useCallback(() => {
    if (timerBeat.current !== null) {
      window.clearTimeout(timerBeat.current);
      timerBeat.current = null;
    }
    setTimerHabit(null);
  }, []);

  // Spec §6: after completion the finished ring stays visible for a beat, then closes.
  const finishTimer = useCallback(() => {
    timerBeat.current = window.setTimeout(closeTimer, 700);
  }, [closeTimer]);

  // Never let a pending close beat outlive the screen itself.
  useEffect(() => () => {
    if (timerBeat.current !== null) window.clearTimeout(timerBeat.current);
  }, []);

  const habits = useLiveQuery(() => listHabits(), []);
  // A 40-day window so per-habit streaks and the header flame come from real
  // history; the visible day's values are filtered out of it below.
  const rangeStart = addDays(date, -40);
  const entries = useLiveQuery(() => loadRange(rangeStart, date), [rangeStart, date]);
  const groups = useMemo(() => {
    const list = habits ?? [];
    const map = new Map<string, Habit[]>();
    for (const habit of list) {
      if (!habit.frequency.includes(new Date(`${date}T12:00:00`).getDay())) continue;
      const bucket = map.get(habit.category) ?? [];
      bucket.push(habit);
      map.set(habit.category, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [habits, date]);

  // Form suggestions for the header's `+` — same lists HabitsPanel uses in Settings.
  const categories = useMemo(
    () => [...new Set((habits ?? []).map((h) => h.category))].sort(),
    [habits],
  );
  const intentions = useMemo(
    () => [...new Set((habits ?? []).map((h) => h.intention).filter(Boolean))].sort(),
    [habits],
  );

  const values = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of entries ?? []) if (entry.date === date) map[entry.habitId] = entry.value;
    return map;
  }, [entries, date]);

  const streaks = useMemo(
    () => habitStreaks(habits ?? [], entries ?? [], date),
    [habits, entries, date],
  );

  const overallStreak = useMemo(() => {
    if (!habits || !entries) return 0;
    const stats = buildDayStats(habits, entries, { from: addDays(date, -40), to: date });
    return currentStreak(stats, date);
  }, [habits, entries, date]);

  const setValue = useCallback(async (habit: Habit, value: number) => {
    await putEntry(habit.id, date, Math.max(0, value));
  }, [date]);

  const saveHabit = useCallback(async (habit: Habit) => {
    await putHabit(habit);
    setCreating(null);
  }, []);

  const toggle = useCallback((habit: Habit) => {
    void setValue(habit, (values[habit.id] ?? 0) > 0 ? 0 : (habit.type === 'boolean' ? 1 : habit.target));
  }, [setValue, values]);

  const step = useCallback((habit: Habit, delta: number) => {
    void setValue(habit, (values[habit.id] ?? 0) + delta);
  }, [setValue, values]);

  const toggleCollapse = useCallback((category: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [category]: !prev[category] };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const isFuture = classifyDate(date, today) === 'future';
  const isPast = classifyDate(date, today) === 'past';

  return (
    <div className="mx-auto w-full max-w-3xl px-2 sm:px-4">
      {/* Spec §5.1: hamburger (mobile) | centered title | flame + streak | `+`.
          The hamburger hides at md where the rail/sidebar nav takes over, and
          the title is absolutely centered rather than justify-between aligned. */}
      <header className="relative flex items-center gap-3 px-2 py-4">
        <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-muted)] md:hidden">
          <Menu size={18} />
        </button>
        {/* Date-derived text: prerendered HTML can't match the client's current day. */}
        <h1 suppressHydrationWarning
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-extrabold">
          {isPast ? formatLong(date) : 'Today'}
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-bold">
            <Flame size={18} className="text-[#f97316]" fill="#f97316" /> {overallStreak}
          </span>
          <button type="button" aria-label="Add habit" onClick={() => setCreating(blankHabit())}
                  className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-muted)]">
            <Plus size={18} />
          </button>
        </div>
      </header>

      <DateStrip selected={date} today={today}
                 onSelect={(key) => router.push(key === today ? '/today' : `/today/${key}`)} />

      {habits === undefined ? (
        <p className="p-6 text-center text-sm text-[var(--color-subtle)]">Loading…</p>
      ) : habits.length === 0 ? (
        <div className="p-10 text-center">
          <p className="mb-3 text-base font-semibold">Create your first habit</p>
          <a href="/settings" className="rounded-2xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            Add a habit
          </a>
        </div>
      ) : isFuture ? (
        <p className="p-6 text-center text-sm text-[var(--color-subtle)]">That day hasn’t happened yet.</p>
      ) : groups.length === 0 ? (
        <p className="p-6 text-center text-sm text-[var(--color-subtle)]">Nothing scheduled on this day.</p>
      ) : (
        // Spec §10: CSS columns for category masonry (grid would leave gaps
        // between unequal-height panels); gap-3 is the gutter between columns.
        <div className="gap-3 md:columns-2 xl:columns-3">
          {groups.map(([category, list]) => (
            <CategorySection
              key={category}
              category={category}
              habits={list}
              collapsed={collapsed[category] ?? false}
              onToggleCollapse={() => toggleCollapse(category)}
              values={values}
              streaks={streaks}
              onToggle={toggle}
              onStep={step}
              onOpenTimer={setTimerHabit}
              onOpenValue={setValueSheet}
            />
          ))}
        </div>
      )}

      {valueSheet && (
        <ValueSheet
          habit={valueSheet}
          value={values[valueSheet.id] ?? 0}
          open
          onSave={(v) => void setValue(valueSheet, v)}
          onClose={() => setValueSheet(null)}
        />
      )}

      {/* Spec §9: `+ New habit` is also available from the Today header. */}
      {creating && (
        <HabitForm
          habit={creating} open categories={categories} intentions={intentions}
          onSave={(h) => void saveHabit(h)} onClose={() => setCreating(null)}
        />
      )}

      {menuOpen && <MenuDrawer open onClose={() => setMenuOpen(false)} />}

      {timerHabit && (
        <TimerModal
          habit={timerHabit}
          initialSeconds={values[timerHabit.id] ?? 0}
          streak={streaks[timerHabit.id] ?? 0}
          date={date}
          onClose={closeTimer}
          onComplete={finishTimer}
        />
      )}
    </div>
  );
}
