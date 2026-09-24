import {
  Activity, AlarmClock, Bath, BedDouble, BookOpen, Brain, CalendarCheck, Check, Coffee, Crown,
  Droplet, Dumbbell, Flame, Flower2, Gift, GraduationCap, Heart, Languages, Moon,
  Music, PenLine, Popcorn, Scale, ShowerHead, Sun, Sunrise, Target, Timer, TriangleAlert,
  Wallet, type LucideIcon,
} from 'lucide-react';
import type { Habit } from './types';

export const ICONS = {
  alarmClock: AlarmClock, bath: Bath, bed: BedDouble, bookOpen: BookOpen, brain: Brain,
  calendarCheck: CalendarCheck, check: Check, coffee: Coffee, crown: Crown, droplet: Droplet,
  dumbbell: Dumbbell, flame: Flame, flower2: Flower2, gift: Gift, graduation: GraduationCap,
  heart: Heart, languages: Languages, moon: Moon, music: Music, pen: PenLine,
  popcorn: Popcorn, scale: Scale, showerHead: ShowerHead, sunrise: Sunrise, sun: Sun, target: Target,
  timer: Timer, triangleAlert: TriangleAlert, wallet: Wallet, workout: Activity,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;
export const ICON_CHOICES = Object.keys(ICONS) as IconName[];

export function nameIcon(name: string): LucideIcon {
  return ICONS[name as IconName] ?? PenLine;
}

const CATEGORY_MAP: Record<string, IconName> = {
  morning: 'sunrise', afternoon: 'sun', evening: 'moon', night: 'moon',
  health: 'heart', mind: 'brain', work: 'wallet', study: 'graduation',
};

export function categoryIcon(name: string): LucideIcon {
  const key = name.trim().toLowerCase();
  const mapped = CATEGORY_MAP[key];
  return nameIcon(mapped ?? ICON_CHOICES[stablePick(key)]);
}

function stablePick(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % ICON_CHOICES.length;
}

/** An intention borrows the icon of its first habit — no extra field, no drift. */
export function intentionIcon(habits: Habit[], intention?: string): LucideIcon {
  const match = intention ? habits.find((h) => h.intention === intention) : undefined;
  return nameIcon((match ?? habits[0])?.icon ?? 'crown');
}
