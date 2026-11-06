import { HABIT_COLORS } from './colors';
import { addDays, fromKey, todayKey } from './dates';
import { iconNameFor } from './icons';
import type { Habit, HabitSuggestion, RecommendationCache } from './types';

/** The model is asked for 3–5; anything valid it returns is kept, capped at 5. */
export const MAX_SUGGESTIONS = 5;
export const REQUESTED_MIN = 3;

/** Wall-clock and data windows from the spec: 7 days of new entries. */
export const REGENERATE_AFTER_DAYS = 7;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'habit';
}

/**
 * Spec R5: the one place a model reply becomes trusted data. Both the server
 * route and the on-device path call this, so a malformed response (wrong shape,
 * empty names, duplicates, 12 items) can never reach the UI.
 */
export function normalizeSuggestions(value: unknown): HabitSuggestion[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: HabitSuggestion[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = text(row.name, 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const suggestedTime = typeof row.suggestedTime === 'string' && TIME_PATTERN.test(row.suggestedTime.trim())
      ? row.suggestedTime.trim()
      : '';
    out.push({
      id: `${slug(name)}-${out.length}`,
      name,
      reason: text(row.reason, 240),
      suggestedTime,
      firstStep: text(row.firstStep, 160),
    });
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

/** Days between two day keys; NaN-safe (an unparsable key means "no data"). */
function daysBetween(from: string, to: string): number {
  const a = fromKey(from);
  const b = fromKey(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Spec R4: regenerate when there is nothing cached, when the answers changed
 * after generation, or when entries exist at least a week beyond what the model
 * last saw. A quiet week is not new data, so it does not force a call.
 */
export function recommendationsStale({
  cache, profileUpdatedAt, latestEntryDate,
}: {
  cache: RecommendationCache | null;
  profileUpdatedAt: number;
  latestEntryDate: string | null;
}): boolean {
  if (!cache || cache.suggestions.length === 0) return true;
  if (profileUpdatedAt > cache.generatedAt) return true;
  if (!latestEntryDate) return false;
  if (!cache.dataThrough) return true;
  return daysBetween(cache.dataThrough, latestEntryDate) >= REGENERATE_AFTER_DAYS;
}

export function cacheSuggestions(
  suggestions: HabitSuggestion[],
  source: RecommendationCache['source'],
  dataThrough: string,
  now = Date.now(),
): RecommendationCache {
  return { generatedAt: now, dataThrough, source, suggestions: suggestions.slice(0, MAX_SUGGESTIONS) };
}

/** Category from the suggested time, so home groups the habit where it belongs. */
export function categoryForTime(time: string): string {
  if (!TIME_PATTERN.test(time)) return 'Morning';
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

/** Spec R4: "Add to my habits" writes a normal habit; nothing about it is special. */
export function suggestionToHabit(suggestion: HabitSuggestion, now = Date.now()): Habit {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `id-${now}-${Math.random().toString(36).slice(2)}`,
    name: suggestion.name,
    icon: iconNameFor(suggestion.name),
    color: HABIT_COLORS[Math.abs(now + suggestion.name.length) % HABIT_COLORS.length],
    category: categoryForTime(suggestion.suggestedTime),
    intention: 'Do Hard Things',
    type: 'boolean',
    target: 1,
    unit: '',
    frequency: [0, 1, 2, 3, 4, 5, 6],
    order: 0,
    createdAt: now,
    difficulty: 'medium',
    reminderTime: suggestion.suggestedTime,
  };
}

/** History summary sent to either model: counts only, no habit notes or timestamps. */
export function historyWindow(today = todayKey()): { from: string; to: string } {
  return { from: addDays(today, -13), to: today };
}
