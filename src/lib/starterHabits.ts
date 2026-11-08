import { HABIT_COLORS } from './colors';
import type { Habit } from './types';

/**
 * Onboarding v2: a curated starter library instead of an empty form.
 *
 * Why a fixed list rather than AI here: the first session must work offline,
 * instantly, and without a profile — and the literature on habit apps is blunt
 * that a blank "add your first habit" screen is where people leave. Every entry
 * carries a one-line reason and a first step small enough to do today, which is
 * the pattern the strongest apps in the category use.
 */
export const GOAL_OPTIONS = [
  'Move more',
  'Feel better',
  'Focus better',
  'Sleep better',
  'Eat better',
  'Less screen time',
  'Read more',
  'Save money',
] as const;

export type GoalOption = typeof GOAL_OPTIONS[number];

export interface StarterHabit {
  id: string;
  name: string;
  emoji: string;
  goals: GoalOption[];
  why: string;
  firstStep: string;
  time: string;     // 'HH:MM'
  icon: string;     // key into ICONS (src/lib/icons.ts)
  category: string;
}

export const MAX_STARTERS = 3;

export const STARTER_HABITS: readonly StarterHabit[] = [
  {
    id: 'walk-10',
    name: '10-minute walk',
    emoji: '🚶',
    goals: ['Move more', 'Feel better'],
    why: 'Short walks count. Ten minutes is enough to change a day.',
    firstStep: 'Put your shoes on and step outside for two minutes.',
    time: '07:30',
    icon: 'morning',
    category: 'Morning',
  },
  {
    id: 'pushups-5',
    name: '5 push-ups',
    emoji: '💪',
    goals: ['Move more'],
    why: 'Five is the version you will still do on a bad day.',
    firstStep: 'Do them against a wall or on your knees — same habit.',
    time: '08:00',
    icon: 'dumbbell',
    category: 'Morning',
  },
  {
    id: 'water',
    name: 'Glass of water on waking',
    emoji: '💧',
    goals: ['Feel better', 'Eat better'],
    why: 'Easiest win of the day, and it anchors everything after it.',
    firstStep: 'Put a glass by the sink tonight.',
    time: '07:00',
    icon: 'health',
    category: 'Morning',
  },
  {
    id: 'breathe-2',
    name: '2 minutes of breathing',
    emoji: '🫁',
    goals: ['Feel better', 'Focus better'],
    why: 'A reset you can do anywhere, without changing clothes.',
    firstStep: 'Four counts in, four counts out, once.',
    time: '08:00',
    icon: 'heart',
    category: 'Morning',
  },
  {
    id: 'focus-block',
    name: 'One 25-minute focus block',
    emoji: '🎯',
    goals: ['Focus better'],
    why: 'One protected block beats an ambitious plan you abandon.',
    firstStep: 'Phone in another room, timer on, one task only.',
    time: '09:30',
    icon: 'timer',
    category: 'Morning',
  },
  {
    id: 'desk-reset',
    name: '2-minute desk reset',
    emoji: '🧹',
    goals: ['Focus better'],
    why: 'Tidy surface, tidier head — and it ends the workday properly.',
    firstStep: 'Clear one square foot. That is the whole task.',
    time: '17:30',
    icon: 'calendarCheck',
    category: 'Afternoon',
  },
  {
    id: 'fruit',
    name: 'Fruit with breakfast',
    emoji: '🍎',
    goals: ['Eat better'],
    why: 'Adds something instead of removing something — easier to keep.',
    firstStep: 'Put fruit where you will see it tomorrow morning.',
    time: '08:00',
    icon: 'health',
    category: 'Morning',
  },
  {
    id: 'no-phone-morning',
    name: 'No phone for 30 minutes after waking',
    emoji: '📵',
    goals: ['Less screen time', 'Sleep better'],
    why: 'Protects the only quiet part of the day before it fills up.',
    firstStep: 'Charge the phone outside the bedroom tonight.',
    time: '07:00',
    icon: 'alarmClock',
    category: 'Morning',
  },
  {
    id: 'phone-out-of-bed',
    name: 'Phone out of bed',
    emoji: '🌙',
    goals: ['Sleep better', 'Less screen time'],
    why: 'One location change does more than any sleep app.',
    firstStep: 'Move the charger across the room before you go to bed.',
    time: '22:00',
    icon: 'alarmClock',
    category: 'Evening',
  },
  {
    id: 'lights-down',
    name: 'Lights down at 22:30',
    emoji: '💡',
    goals: ['Sleep better'],
    why: 'A cue, not a rule — the signal your body actually needs.',
    firstStep: 'Set a phone reminder for 22:15 tonight.',
    time: '22:30',
    icon: 'alarmClock',
    category: 'Evening',
  },
  {
    id: 'read-2',
    name: 'Read 2 pages',
    emoji: '📖',
    goals: ['Read more', 'Less screen time'],
    why: 'Two pages is small enough to survive a bad day.',
    firstStep: 'Leave the book on your pillow.',
    time: '21:30',
    icon: 'popcorn',
    category: 'Evening',
  },
  {
    id: 'log-spend',
    name: "Log today's spending",
    emoji: '💰',
    goals: ['Save money'],
    why: 'Awareness first — you cannot cut what you cannot see.',
    firstStep: 'Open your banking app and note one number.',
    time: '20:00',
    icon: 'calendarCheck',
    category: 'Evening',
  },
];

/**
 * Ranked picker list: habits serving the chosen goals first, then the rest as
 * filler so a skipped goals step still has options. Stable order, no shuffling
 * (predictable beats novel when the user is one screen from a habit).
 */
export function starterFor(goals: readonly string[], limit = 6): StarterHabit[] {
  const wanted = new Set(goals);
  const matching = STARTER_HABITS.filter((habit) => habit.goals.some((goal) => wanted.has(goal)));
  const rest = STARTER_HABITS.filter((habit) => !matching.includes(habit));
  return [...matching, ...rest].slice(0, limit);
}

/** "Pick these" writes ordinary boolean habits; nothing about them is special. */
export function starterToHabit(starter: StarterHabit, index: number, now = Date.now()): Habit {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `id-${now}-${index}-${Math.random().toString(36).slice(2)}`,
    name: starter.name,
    icon: starter.icon,
    color: HABIT_COLORS[index % HABIT_COLORS.length],
    category: starter.category,
    intention: 'Small steps',
    type: 'boolean',
    target: 1,
    unit: '',
    frequency: [0, 1, 2, 3, 4, 5, 6],
    order: index,
    createdAt: now,
    difficulty: 'easy',
    reminderTime: starter.time,
  };
}
