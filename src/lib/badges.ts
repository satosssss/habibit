import { todayKey } from './dates';
import {
  allTimeStart, buildDayStats, countPerfectDays, longestStreak, sumCompletions,
} from './stats';
import type { Challenge, Entry, Habit } from './types';

export type BadgeKind = 'streak' | 'perfect' | 'completions' | 'challenge';
export type BadgeIcon = 'flame' | 'star' | 'check' | 'trophy';

export interface BadgeDef {
  id: string;
  title: string;
  /** Locked-state copy (spec R1). Never shown as the only status: earned
   *  badges carry a date and locked ones carry current / target. */
  description: string;
  kind: BadgeKind;
  threshold: number;
  icon: BadgeIcon;
  /** Only for kind === 'challenge'. */
  challengeType?: Challenge['type'];
}

/**
 * Badges spec R1: permanent achievements over all-time data. Titles and
 * thresholds are binding — the UI and tests read this catalog, never a copy.
 */
export const BADGES: readonly BadgeDef[] = [
  { id: 'streak-3', title: 'Warming Up', description: '3-day streak', kind: 'streak', threshold: 3, icon: 'flame' },
  { id: 'streak-7', title: 'One Week Strong', description: '7-day streak', kind: 'streak', threshold: 7, icon: 'flame' },
  { id: 'streak-14', title: 'Two Weeks Running', description: '14-day streak', kind: 'streak', threshold: 14, icon: 'flame' },
  { id: 'streak-30', title: 'Thirty Days', description: '30-day streak', kind: 'streak', threshold: 30, icon: 'flame' },
  { id: 'streak-100', title: 'Century', description: '100-day streak', kind: 'streak', threshold: 100, icon: 'flame' },
  { id: 'perfect-1', title: 'Perfect Day', description: '1 perfect day', kind: 'perfect', threshold: 1, icon: 'star' },
  { id: 'perfect-7', title: 'Perfect Week', description: '7 perfect days', kind: 'perfect', threshold: 7, icon: 'star' },
  { id: 'perfect-30', title: 'Flawless Month', description: '30 perfect days', kind: 'perfect', threshold: 30, icon: 'star' },
  { id: 'completions-1', title: 'First Step', description: '1 completion', kind: 'completions', threshold: 1, icon: 'check' },
  { id: 'completions-10', title: 'Getting Going', description: '10 completions', kind: 'completions', threshold: 10, icon: 'check' },
  { id: 'completions-50', title: 'Fifty Strong', description: '50 completions', kind: 'completions', threshold: 50, icon: 'check' },
  { id: 'completions-100', title: 'Centurion', description: '100 completions', kind: 'completions', threshold: 100, icon: 'check' },
  { id: 'completions-365', title: 'Year of Habit', description: '365 completions', kind: 'completions', threshold: 365, icon: 'check' },
  { id: 'challenge-streak7', title: 'Streak Champion', description: 'Win a 7-Day Streak challenge', kind: 'challenge', threshold: 1, icon: 'trophy', challengeType: 'streak7' },
  { id: 'challenge-weekend', title: 'Weekend Warrior', description: 'Win a Weekend Warrior challenge', kind: 'challenge', threshold: 1, icon: 'trophy', challengeType: 'weekend' },
  { id: 'challenge-category7', title: 'Category Master', description: 'Win a Category Sprint challenge', kind: 'challenge', threshold: 1, icon: 'trophy', challengeType: 'category7' },
];

export function badgeById(id: string): BadgeDef | null {
  return BADGES.find((b) => b.id === id) ?? null;
}

export interface BadgeSnapshot {
  streak: number;
  perfect: number;
  completions: number;
  wins: ReadonlySet<Challenge['type']>;
}

/**
 * One stats pass for the whole catalog (spec R2). Streak/perfect/completions
 * come from stats.ts — the same numbers Insights shows — so a badge can never
 * disagree with the dashboard. Challenge wins are terminal rows, which is why
 * they survive a later reset of the active challenge.
 */
export function badgeSnapshot(input: {
  habits: Habit[];
  entries: Entry[];
  challenges: Challenge[];
  today?: string;
}): BadgeSnapshot {
  const wins = new Set(
    input.challenges.filter((c) => c.status === 'won').map((c) => c.type),
  );
  // No habits → no scheduled days and nothing to earn; skip the all-time walk.
  if (input.habits.length === 0) {
    return { streak: 0, perfect: 0, completions: 0, wins };
  }
  const today = input.today ?? todayKey();
  const stats = buildDayStats(input.habits, input.entries, {
    from: allTimeStart(input.habits),
    to: today,
  });
  return {
    streak: longestStreak(stats),
    perfect: countPerfectDays(stats),
    completions: sumCompletions(stats),
    wins,
  };
}

export function badgeValue(def: BadgeDef, snapshot: BadgeSnapshot): number {
  switch (def.kind) {
    case 'streak': return snapshot.streak;
    case 'perfect': return snapshot.perfect;
    case 'completions': return snapshot.completions;
    case 'challenge':
      return def.challengeType && snapshot.wins.has(def.challengeType) ? 1 : 0;
  }
}

export function earnedBadgeIds(snapshot: BadgeSnapshot): string[] {
  return BADGES.filter((b) => badgeValue(b, snapshot) >= b.threshold).map((b) => b.id);
}
