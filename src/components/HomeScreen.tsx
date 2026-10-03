'use client';

import { Flame, Menu, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { todayKey } from '@/lib/dates';
import { loadRange, listHabits, putEntry } from '@/lib/repo';
import { allTimeStart, buildDayStats, currentStreak } from '@/lib/stats';
import { reportWriteError } from '@/lib/writeError';
import { habitStreaks } from '@/lib/streaks';
import { toggleValue } from '@/lib/values';
import { celebrateIfCompleted } from '@/lib/completionToast';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { Habit } from '@/lib/types';
import { CategorySection } from './CategorySection';
import { DateStrip } from './DateStrip';
import { MenuDrawer } from './MenuDrawer';
import { StreakStrip } from './StreakStrip';
import { TimerModal } from './TimerModal';
import { ValueSheet } from './ValueSheet';

const STORE_KEY = 'habibit:collapsed';
const readCollapsed = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { return {}; }
};

// `date` defaults to the current day at render time so the statically
// prerendered /today route never freezes on the build date.
export function HomeScreen({ date = todayKey() }: { date?: string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [valueSheet, setValueSheet] = useState<Habit | null>(null);
  const [timerHabit, setTimerHabit] = useState<Habit | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Date-derived text renders only after mount: prerendered HTML must stay
  // clock-independent, or a static /today build freezes its build day into
  // the DOM (React keeps the server DOM on a suppressed mismatch and later
  // renders then diff against its own prior client output, never writing).
  const [mounted, setMounted] = useState(false);
  const timerBeat = useRef<number | null>(null);
  const router = useRouter();
  const today = todayKey();

  useEffect(() => setMounted(true), []);
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
  // Spec §3/R1: full history — the same window Stats uses. Before habits
  // load this is the fixed early constant; liveQuery re-subscribes when the
  // earliest createdAt year refines it.
  const rangeStart = allTimeStart(habits ?? []);
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
    const stats = buildDayStats(habits, entries, { from: rangeStart, to: date });
    return currentStreak(stats, date);
  }, [habits, entries, date, rangeStart]);

  const setValue = useCallback(async (habit: Habit, value: number) => {
    const before = values[habit.id] ?? 0;
    try {
      await putEntry(habit.id, date, value);   // putEntry owns the clamp (R1)
      celebrateIfCompleted(habit, before, value);   // A2: only after a successful write
    }
    catch (err) { reportWriteError(err); }           // failure → banner, never a toast
  }, [date, values]);

  // Spec R2: one shared completion toggle — done → 0, not-done → full target,
  // identical to NoteScreen's checkbox (toggleValue in lib/values).
  const toggle = useCallback((habit: Habit) => {
    void setValue(habit, toggleValue(habit, values[habit.id] ?? 0));
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

  return (
    <div className="mx-auto w-full max-w-3xl px-2 sm:px-4 xl:max-w-6xl">
      {/* Spec §5.1: hamburger (mobile) | centered title | flame + streak | `+`.
          The hamburger hides at md where the rail/sidebar nav takes over, and
          the title is absolutely centered rather than justify-between aligned. */}
      <header className="relative flex items-center gap-3 px-2 py-4">
        <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-muted)] md:hidden">
          <Menu size={18} />
        </button>
        {/* Date-derived text stays empty in prerendered HTML and fills in only
            after mount, so the build day can never freeze into the h1. */}
        <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-lg font-extrabold">
          {mounted ? 'Today' : ''}
        </h1>
        <div className="ml-auto flex items-center gap-3">
          <span data-testid="header-streak" className="flex items-center gap-1 text-sm font-bold">
            <Flame size={18} className="text-[#f97316]" fill="#f97316" /> {overallStreak}
          </span>
          <button type="button" aria-label="Add habit" onClick={() => router.push('/add-habit')}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-muted)]">
            <Plus size={18} />
          </button>
        </div>
      </header>

      <DateStrip selected={date} today={today}
                 onSelect={(key) => router.push(key === today ? '/' : `/today/${key}`)} />

      {habits !== undefined && entries !== undefined && habits.length > 0 && (
        <StreakStrip habits={habits} entries={entries} today={date} />
      )}

      {habits === undefined || entries === undefined ? (
        <p className="skeleton p-6 text-center text-sm text-[var(--color-subtle)]">Loading…</p>
      ) : habits.length === 0 ? (
        <div className="p-10 text-center">
          <p className="mb-3 text-base font-semibold">Create your first habit</p>
          {/* Spec R2: client-side route, not a full page load. */}
          <Link href="/add-habit" className="btn-primary text-sm">
            Add a habit
          </Link>
        </div>
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

      {/* Spec §9: creating a habit now lives on /add-habit (slice E R2). */}
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
