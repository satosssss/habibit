'use client';

import { Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatLong, todayKey, weekdayIndex } from '@/lib/dates';
import { listHabits, loadRange, putEntry } from '@/lib/repo';
import { isCompleted } from '@/lib/stats';
import { clampedValue, toggleValue } from '@/lib/values';
import { celebrateIfCompleted } from '@/lib/completionToast';
import { reportWriteError } from '@/lib/writeError';
import { intentionColor } from '@/lib/colors';
import { intentionIcon } from '@/lib/icons';
import { quoteFor } from '@/lib/quotes';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { Habit } from '@/lib/types';
import { Heatmap } from './Heatmap';

export function NoteScreen({ date }: { date: string }) {
  const year = Number(date.slice(0, 4));
  const habits = useLiveQuery(() => listHabits(), []);
  // The whole year, not just this day: the compact heatmap renders the VIEWED
  // DATE's full-year grid (its own cell always in-window); the checklist
  // filters down to `date`.
  const entries = useLiveQuery(
    () => loadRange(`${year}-01-01`, `${year}-12-31`),
    [year],
  );
  const quote = useMemo(() => quoteFor(date), [date]);
  const today = todayKey();
  const [shareMsg, setShareMsg] = useState<'copied' | 'failed' | null>(null);

  const values = useMemo(() => {
    const map: Record<string, number> = {};
    for (const entry of entries ?? []) if (entry.date === date) map[entry.habitId] = entry.value;
    return map;
  }, [entries, date]);

  // The day's checklist: only habits that were actually scheduled that day,
  // grouped by intention (spec §8 — never by category).
  const groups = useMemo(() => {
    const day = weekdayIndex(date);
    const map = new Map<string, Habit[]>();
    for (const habit of habits ?? []) {
      if (!habit.frequency.includes(day)) continue;
      const bucket = map.get(habit.intention) ?? [];
      bucket.push(habit);
      map.set(habit.intention, bucket);
    }
    // Spec §7.3 / R2: habits within an intention follow their order field
    // (matching Stats), not retrieval/insertion order.
    for (const bucket of map.values()) bucket.sort((a, b) => a.order - b.order);
    return [...map.entries()];
  }, [habits, date]);

  const share = async () => {
    const url = `${window.location.origin}/today/${date}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Habibit', url }); return; } catch { /* dismissed — no status */ }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setShareMsg('copied');
    } catch {
      setShareMsg('failed');
    }
    window.setTimeout(() => setShareMsg(null), 2500);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        {/* NoteScreen renders only post-mount (page.tsx gates the branch) and
            the text derives from the route param, never the clock — so the h1
            can never mismatch hydration; no suppression flag needed. */}
        <h1 className="text-lg font-extrabold">{formatLong(date)}</h1>
        <button type="button" aria-label="Share this day" onClick={() => void share()}
                className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-muted)]">
          <Share2 size={16} />
        </button>
      </header>

      <p role="status" aria-live="polite" className="min-h-4 text-xs text-[var(--color-subtle)]">{shareMsg === 'copied' ? 'Link copied' : shareMsg === 'failed' ? "Couldn't copy the link" : ''}</p>

      <blockquote className="mb-5 rounded-2xl bg-[var(--color-panel)] px-4 py-3 text-sm italic">
        “{quote.text}” <span className="not-italic text-[var(--color-subtle)]">— {quote.author}</span>
      </blockquote>

      <Heatmap year={year} habits={habits ?? []} entries={entries ?? []} today={today} focusDate={date} compact />

      <div className="mt-5 flex flex-col gap-3">
        {habits === undefined || entries === undefined ? (
          <p className="p-6 text-center text-sm text-[var(--color-subtle)]">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--color-subtle)]">Nothing scheduled this day.</p>
        ) : groups.map(([intention, list]) => {
          const color = intentionColor(intention);
          const Icon = intentionIcon(list, intention);
          return (
            <section key={intention} className="rounded-3xl p-4" style={{ background: color }}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-white">
                <Icon size={16} /> {intention.toUpperCase()}
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((habit) => {
                  const v = clampedValue(habit, values[habit.id] ?? 0);
                  const done = isCompleted(habit, v);
                  return (
                    <li key={habit.id}
                        className="flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2 text-white">
                      <input
                        type="checkbox"
                        aria-label={habit.name}
                        checked={done}
                        onChange={() => {
                          const next = toggleValue(habit, v);
                          void putEntry(habit.id, date, next)
                            .then(() => celebrateIfCompleted(habit, v, next))   // A2: after success only
                            .catch(reportWriteError);
                        }}
                        className="h-4 w-4 accent-white"
                      />
                      <span className={done ? 'line-through opacity-80' : ''}>{habit.name}</span>
                      {habit.type !== 'boolean' && (
                        <span className="ml-auto text-xs text-white/70">
                          {habit.type === 'quantity'
                            ? `${v}/${habit.target}${habit.unit ? ` ${habit.unit}` : ''}`
                            : `${Math.round(v / 60)}/${Math.round(habit.target / 60)} minutes`}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
