import type { IconName } from './icons';
import type { HabitType } from './types';

/** Spec slice E §9: static, code-only habit templates. Not user-editable. */
export interface TemplateHabit {
  name: string;
  icon: IconName;
  color: string;      // must be one of HABIT_COLORS
  category: string;   // the group label
  intention: string;
  type: HabitType;
  target: number;     // timer = seconds, quantity = ≥1, boolean = 1
  unit: string;       // quantity only, else ''
}

export interface TemplateGroup {
  key: 'good' | 'health' | 'bad' | 'todo';
  label: string;
  habits: TemplateHabit[];
}

const good = (name: string, icon: IconName, color: string, rest: Partial<TemplateHabit> = {}): TemplateHabit => ({
  name, icon, color, category: 'Good', intention: 'Growth',
  type: 'boolean', target: 1, unit: '', ...rest,
});
const health = (name: string, icon: IconName, color: string, rest: Partial<TemplateHabit> = {}): TemplateHabit => ({
  name, icon, color, category: 'Health', intention: 'Health',
  type: 'boolean', target: 1, unit: '', ...rest,
});
const bad = (name: string, icon: IconName, color: string): TemplateHabit => ({
  name, icon, color, category: 'Bad', intention: 'Discipline',
  type: 'boolean', target: 1, unit: '',
});
const todo = (name: string, icon: IconName, color: string, rest: Partial<TemplateHabit> = {}): TemplateHabit => ({
  name, icon, color, category: 'To-do', intention: 'Focus',
  type: 'boolean', target: 1, unit: '', ...rest,
});

export const TEMPLATE_GROUPS: readonly TemplateGroup[] = [
  {
    key: 'good', label: 'Good',
    habits: [
      good('Meditate', 'flower2', '#c026d3', { type: 'timer', target: 600 }),
      good('Reading', 'bookOpen', '#14b8a6', { type: 'quantity', target: 20, unit: 'minutes' }),
      good('Journal', 'pen', '#f59e0b', { type: 'quantity', target: 5, unit: 'minutes' }),
      good('Gratitude', 'heart', '#ec4899'),
      good('Deep Work', 'brain', '#6366f1', { type: 'timer', target: 1500 }),
      good('Wake Early', 'sunrise', '#f97316'),
      good('Practice Language', 'languages', '#22d3ee', { type: 'quantity', target: 15, unit: 'minutes' }),
    ],
  },
  {
    key: 'health', label: 'Health',
    habits: [
      health('Steps', 'workout', '#22c55e', { type: 'quantity', target: 10000, unit: 'steps' }),
      health('Run', 'flame', '#f97316', { type: 'quantity', target: 5, unit: 'km' }),
      health('Cycle', 'sun', '#22d3ee', { type: 'quantity', target: 10, unit: 'km' }),
      health('Swim', 'bath', '#3b82f6', { type: 'quantity', target: 30, unit: 'minutes' }),
      health('Stretch', 'flower2', '#14b8a6', { type: 'quantity', target: 10, unit: 'minutes' }),
      health('Workout', 'dumbbell', '#c026d3', { type: 'quantity', target: 30, unit: 'minutes' }),
      health('Sleep', 'bed', '#6366f1', { type: 'quantity', target: 8, unit: 'hours' }),
    ],
  },
  {
    key: 'bad', label: 'Bad',
    habits: [
      bad('No Junk Food', 'popcorn', '#ef4444'),
      bad('No Smoking', 'triangleAlert', '#f97316'),
      bad('No Soda', 'droplet', '#3b82f6'),
      bad('No Late-Night Scrolling', 'moon', '#6366f1'),
      bad('No Impulse Buying', 'wallet', '#f59e0b'),
      bad('No Oversleeping', 'alarmClock', '#ec4899'),
    ],
  },
  {
    key: 'todo', label: 'To-do',
    habits: [
      todo('Plan Tomorrow', 'calendarCheck', '#6366f1'),
      todo('Review Goals', 'target', '#22c55e'),
      todo('Inbox Zero', 'check', '#3b82f6'),
      todo('Prep Meals', 'coffee', '#14b8a6'),
      todo('Tidy Up', 'showerHead', '#f59e0b', { type: 'quantity', target: 10, unit: 'minutes' }),
      todo('Weekly Review', 'graduation', '#c026d3'),
    ],
  },
];
