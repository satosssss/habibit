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

/** Badges spec R3: one row per earned badge, keyed by catalog id. */
export interface EarnedBadge {
  id: string;              // catalog id from src/lib/badges.ts
  earnedAt: number;        // epoch ms, first time the threshold was met
}

export type ActivityLevel = 'low' | 'moderate' | 'high';
export type CoachingTone = 'gentle' | 'direct';

/** Profile spec R2: the onboarding answers, one row, id 'me'. */
export interface ProfileLifestyle {
  wakeTime: string;        // 'HH:MM'
  sleepTime: string;       // 'HH:MM'
  schedule: string;        // free text: work/school shape
  activityLevel: ActivityLevel;
  currentHabits: string;
  timeSinks: string;
}

export interface ProfileGoals {
  items: string[];         // 1-3 entries, trimmed; empty strings dropped on save
  timeframe: string;
  why: string;
}

export interface ProfilePreferences {
  reminderTime: string;    // 'HH:MM' or ''
  tone: CoachingTone;
}

/** One AI suggestion; `id` is stable for the cache lifetime only. */
export interface HabitSuggestion {
  id: string;
  name: string;
  reason: string;
  suggestedTime: string;   // 'HH:MM' or ''
  firstStep: string;
}

export interface RecommendationCache {
  generatedAt: number;
  dataThrough: string;     // last entry date the model saw ('YYYY-MM-DD')
  source: 'server' | 'on-device';
  suggestions: HabitSuggestion[];
}

/** Onboarding v2: how the app addresses you. Cosmetic only, never sent to AI. */
export interface ProfileIdentity {
  displayName: string;     // trimmed; '' means "not set"
  avatarId: string;        // key into AVATARS (src/lib/avatars.ts)
}

export interface Profile {
  id: 'me';
  accountEmail: string | null;
  identity: ProfileIdentity;
  lifestyle: ProfileLifestyle;
  goals: ProfileGoals;
  challenges: string;
  preferences: ProfilePreferences;
  skipped: boolean;
  onboardedAt: number;
  updatedAt: number;
  recommendations: RecommendationCache | null;
}
