export type HabitType = 'boolean' | 'quantity' | 'timer';
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const;

export interface Habit {
  id: string;
  name: string;
  icon: string;           // key into ICONS (src/lib/icons.ts)
  color: string;          // hex, row fill
  category: string;       // time/context: Morning, Health, Evening
  intention: string;      // meaning/purpose: Study, Do Hard Things, …
  type: HabitType;
  target: number;         // quantity: units to reach | timer: seconds
  unit: string;           // 'cups' | 'calories' | 'minutes' … (empty for boolean/timer)
  frequency: number[];    // weekday indices, 0 = Sunday
  order: number;          // sort within a category
  createdAt: number;
  difficulty?: Difficulty; // stored preference (add-habit design: form materialises 'medium')
  reminderTime?: string;   // 'HH:MM' local; empty/absent = no preferred reminder
}

export interface Entry {
  id: string;      // `${habitId}_${date}` — one row per habit/day by construction
  habitId: string;
  date: string;    // 'YYYY-MM-DD', local
  value: number;   // boolean 0|1, quantity count, timer seconds done
  timestamp: number;
}

export type ChallengeType = 'streak7' | 'weekend' | 'category7';
export type ChallengeStatus = 'active' | 'won' | 'failed' | 'abandoned';

export interface Challenge {
  id: string;
  type: ChallengeType;
  habitId?: string;        // streak7 scope
  category?: string;       // category7 scope
  scopeLabel: string;      // human-readable scope, shown in UI
  status: ChallengeStatus;
  startedAt: number;       // epoch ms (join time)
  resultAt?: number;       // epoch ms when won/failed/abandoned
}
