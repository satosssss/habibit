import { BADGES } from './badges';
import { monthLabelPositions, todayKey } from './dates';
import {
  buildDayStats, completionRate, countActiveDays, countPerfectDays, heatmapCells,
  longestStreak, sumCompletions, type HeatCell,
} from './stats';
import type { EarnedBadge, Entry, Habit } from './types';

export interface ShareCardMonth {
  label: string;
  column: number;
}

export interface ShareCardModel {
  year: number;
  activeDays: number;
  perfectDays: number;
  completions: number;
  ratePct: number;
  longestStreak: number;
  earnedBadges: number;
  totalBadges: number;
  cells: HeatCell[];
  months: ShareCardMonth[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Share card spec R1: everything the PNG needs, computed from the same stats
 * engine Insights uses. Aggregates only — habit names never enter the model.
 */
export function shareCardModel({
  habits, entries, badges, year, today = todayKey(),
}: {
  habits: Habit[];
  entries: Entry[];
  badges: EarnedBadge[];
  year: number;
  today?: string;
}): ShareCardModel {
  const currentYear = Number(today.slice(0, 4));
  const stats = buildDayStats(habits, entries, {
    from: `${year}-01-01`,
    // A finished year is complete; the current year stops at today so future
    // scheduled slots can never drag the rate down.
    to: year === currentYear ? today : `${year}-12-31`,
  });
  const rate = completionRate(stats);
  // Stored ids are permanent (badges R3); unknown ids from a newer export are
  // ignored rather than counted.
  const known = new Set(BADGES.map((b) => b.id));
  const earned = new Set(badges.map((b) => b.id).filter((id) => known.has(id)));

  return {
    year,
    activeDays: countActiveDays(stats),
    perfectDays: countPerfectDays(stats),
    completions: sumCompletions(stats),
    ratePct: Math.round(rate.rate * 100),
    longestStreak: longestStreak(stats),
    earnedBadges: earned.size,
    totalBadges: BADGES.length,
    cells: heatmapCells(year, habits, entries, today),
    months: monthLabelPositions(year).map(({ month, column }) => ({ label: MONTHS[month], column })),
  };
}
