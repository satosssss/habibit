'use client';

import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { generateSuggestions } from '@/lib/recommendClient';
import { cacheSuggestions, recommendationsStale, suggestionToHabit } from '@/lib/recommendations';
import {
  getProfile, latestEntryDate, listHabits, putHabit, putRecommendations, recommendationHistory,
} from '@/lib/repo';
import { todayKey } from '@/lib/dates';
import { reportWriteError } from '@/lib/writeError';
import { useLiveQuery } from '@/lib/useLiveQuery';
import type { Habit } from '@/lib/types';
import { HabitForm } from './HabitForm';

const headingId = 'recommendations-heading';

function timeLabel(time: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) return 'any time';
  const hour = Number(time.slice(0, 2));
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${time.slice(3)}${suffix}`;
}

/**
 * Accounts spec R4: suggestions are cached on the profile row, regenerated
 * automatically when the cache is stale (new answers, or a week of new data)
 * and on demand. Adding one opens the normal habit form, so nothing about a
 * suggested habit is special once it exists.
 */
export function RecommendationsSection() {
  const profile = useLiveQuery(() => getProfile(), []);
  const latest = useLiveQuery(() => latestEntryDate(), []);
  const habits = useLiveQuery(() => listHabits(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceHint, setDeviceHint] = useState<string | null>(null);
  const [editing, setEditing] = useState<Habit | null>(null);
  const autoTried = useRef<number | null>(null);

  const cache = profile?.recommendations ?? null;
  const stale = profile
    ? recommendationsStale({
        cache,
        profileUpdatedAt: profile.updatedAt,
        latestEntryDate: latest ?? null,
      })
    : false;

  const generate = useCallback(async () => {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const history = await recommendationHistory();
      const result = await generateSuggestions({ profile, history });
      const dataThrough = (await latestEntryDate()) ?? todayKey();
      await putRecommendations(cacheSuggestions(result.suggestions, result.source, dataThrough));
      setDeviceHint(result.deviceStatus === 'downloadable'
        ? 'On-device AI is available on this phone. Install Habibit to use it, even offline.'
        : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate suggestions.');
    } finally {
      setBusy(false);
    }
  }, [profile]);

  // One automatic attempt per profile version: a failing server must not turn
  // into a retry loop, and the user still has the Regenerate button.
  useEffect(() => {
    if (!profile || !stale || busy) return;
    if (autoTried.current === profile.updatedAt) return;
    autoTried.current = profile.updatedAt;
    void generate();
  }, [profile, stale, busy, generate]);

  if (profile === undefined) return null;

  if (!profile) {
    return (
      <section aria-labelledby={headingId} className="mt-4 glass-card p-4">
        <h2 id={headingId} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
          <Sparkles size={14} aria-hidden /> Habit ideas
        </h2>
        <p className="mt-2 text-sm">
          Answer four short questions and Habibit will suggest a few habits that fit your real day.
        </p>
        <Link href="/onboarding" className="mt-3 inline-flex min-h-10 items-center btn-primary px-4 py-2.5 text-sm">
          Set up your profile
        </Link>
      </section>
    );
  }

  const suggestions = cache?.suggestions ?? [];
  const habitNames = new Set((habits ?? []).map((habit) => habit.name.trim().toLowerCase()));

  return (
    <section aria-labelledby={headingId} className="mt-4 glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
          <Sparkles size={14} aria-hidden /> Habit ideas
        </h2>
        <button type="button" onClick={() => void generate()} disabled={busy}
                className="flex min-h-10 items-center gap-1.5 btn-glass px-3 py-2 text-xs font-semibold">
          <RefreshCw size={13} aria-hidden className={busy ? 'motion-safe:animate-spin' : ''} />
          {busy ? 'Thinking…' : 'Regenerate'}
        </button>
      </div>

      {busy && (
        <p role="status" className="mt-3 text-sm text-[var(--color-subtle)]">
          Building suggestions from your profile and recent history…
        </p>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {!busy && !error && suggestions.length === 0 && (
        <p className="mt-3 text-sm text-[var(--color-subtle)]">
          No ideas yet. Tap Regenerate to ask for a few.
        </p>
      )}

      {suggestions.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {suggestions.map((suggestion) => {
            const taken = habitNames.has(suggestion.name.toLowerCase());
            return (
              <li key={suggestion.id} className="rounded-2xl border border-[var(--color-line)] p-4">
                <h3 className="text-sm font-bold">{suggestion.name}</h3>
                {suggestion.reason && (
                  <p className="mt-1 text-sm text-[var(--color-subtle)]">{suggestion.reason}</p>
                )}
                <p className="mt-2 text-xs text-[var(--color-subtle)]">
                  <span className="font-semibold text-[var(--color-fg)]">When:</span>{' '}
                  {timeLabel(suggestion.suggestedTime)}
                  {suggestion.firstStep && (
                    <>
                      {' · '}
                      <span className="font-semibold text-[var(--color-fg)]">First step:</span>{' '}
                      {suggestion.firstStep}
                    </>
                  )}
                </p>
                <button type="button" disabled={taken}
                        onClick={() => setEditing(suggestionToHabit(suggestion))}
                        className="mt-3 flex min-h-10 items-center gap-1.5 btn-glass px-3.5 py-2 text-sm font-semibold disabled:opacity-50">
                  <Plus size={14} aria-hidden />
                  {taken ? 'Already added' : 'Add to my habits'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {cache && suggestions.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-subtle)]">
          {cache.source === 'on-device' ? 'Generated on this device' : 'Generated with Gemini'}
          {' · '}
          Based on your profile and 14 days of history.
        </p>
      )}

      {deviceHint && <p className="mt-2 text-xs text-[var(--color-subtle)]">{deviceHint}</p>}

      <p className="mt-3 text-xs text-[var(--color-subtle)]">
        Your profile stays on this device. Only your goals, routine and completion counts are sent
        when the server generates ideas.
      </p>

      {editing && (
        <HabitForm
          habit={editing}
          open
          onClose={() => setEditing(null)}
          onSave={(habit) => {
            void putHabit(habit).catch(reportWriteError);
          }}
        />
      )}
    </section>
  );
}
