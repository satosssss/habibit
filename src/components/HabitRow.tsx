'use client';

import { Check, Minus, Plus } from 'lucide-react';
import { rgba } from '@/lib/colors';
import { nameIcon } from '@/lib/icons';
import { subtext } from '@/lib/labels';
import type { Habit } from '@/lib/types';
import { clampedValue } from '@/lib/values';
import { FlameBadge } from './FlameBadge';
import { ProgressRing } from './ProgressRing';

export interface HabitRowProps {
  habit: Habit;
  value: number;
  streak: number;
  onToggle: () => void;
  onStep: (delta: number) => void;
  onOpenTimer: () => void;
  onOpenValue: () => void;
}

/**
 * The row fill is the progress bar. `boolean` rows are always fully saturated
 * (the check carries the state) and progress rows keep a 55% floor so the
 * habit-color wash stays visible on a fresh, empty day — the ring and the x/y
 * subtext are the authoritative progress. The fill moves on transform
 * (scaleX), never width, so the glass surface stays cheap to composite (D R6).
 */
export function HabitRow({
  habit, value, streak, onToggle, onStep, onOpenTimer, onOpenValue,
}: HabitRowProps) {
  const v = clampedValue(habit, value);   // display clamps like everything else (R1)
  const ratio = habit.target > 0 ? v / habit.target : 0;
  const fill = habit.type === 'boolean'
    ? (v > 0 ? 1 : 0)
    : Math.max(0.55, Math.min(1, ratio));
  const done = habit.type === 'boolean' ? v > 0 : ratio >= 1;
  const Icon = nameIcon(habit.icon);

  return (
    <li className="glass-row isolate">
      <div data-testid="habit-fill" aria-hidden="true"
           className="absolute inset-y-0 left-0 w-full origin-left"
           style={{
             width: '100%',
             transform: `scaleX(${fill})`,
             background: `linear-gradient(90deg, ${rgba(habit.color, 0.4)} 0%, ${rgba(habit.color, 0.1)} 100%)`,
             transition: 'transform 300ms ease',
           }} />
      <div className="relative flex items-center gap-3 px-3 py-2.5 xl:gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: habit.color }}>
          <Icon size={20} color="#fff" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--color-fg)]">{habit.name}</p>
          <p className="truncate text-xs text-[var(--color-subtle)]">{subtext(habit, v)}</p>
        </div>

        <FlameBadge count={streak} className="pointer-events-none absolute right-3 top-1.5 glass-pill px-1.5" />

        {habit.type === 'quantity' && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" aria-label={`Remove one ${habit.unit || 'unit'}`}
                    disabled={v <= 0}
                    onClick={() => onStep(-1)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full glass-pill disabled:opacity-40">
              <Minus size={16} color={habit.color} />
            </button>
            <button type="button" aria-label={`Add one ${habit.unit || 'unit'}`}
                    disabled={v >= habit.target}
                    onClick={() => onStep(1)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full glass-pill disabled:opacity-40">
              <Plus size={20} color={habit.color} />
            </button>
          </div>
        )}

        {habit.type === 'timer' && (
          <button type="button"
                  aria-label={done
                    ? `Open timer for ${habit.name}, ${Math.round(habit.target / 60)} of ${Math.round(habit.target / 60)} minutes, completed`
                    : `Open timer for ${habit.name}`}
                  onClick={onOpenTimer}
                  className="shrink-0 rounded-full">
            <ProgressRing size={40} stroke={4} progress={ratio} color={habit.color}>
              {done ? <Check size={18} className="text-[var(--color-fg)]" strokeWidth={3} /> : <Plus size={18} className="text-[var(--color-fg)]" />}
            </ProgressRing>
          </button>
        )}

        {habit.type === 'quantity' && (
          <button type="button"
                  aria-label={done
                    ? `Set exact value for ${habit.name}, ${v} of ${habit.target}${habit.unit ? ` ${habit.unit}` : ''}, completed`
                    : `Set exact value for ${habit.name}`}
                  onClick={onOpenValue}
                  className="shrink-0 rounded-full">
            <ProgressRing size={40} stroke={4} progress={ratio} color={habit.color}>
              {done ? (
                <Check size={16} className="text-[var(--color-fg)]" strokeWidth={3} />
              ) : (
                <span className="text-[10px] font-bold text-[var(--color-fg)]">{Math.floor(ratio * 100)}</span>
              )}
            </ProgressRing>
          </button>
        )}

        {/* Slice A2 R1: one check control for every type — completes/undoes
            via the shared toggle; ring and steppers keep their jobs. */}
        <button type="button"
                aria-label={done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
                onClick={onToggle}
                className={done
                  ? 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow'
                  : 'grid h-10 w-10 shrink-0 place-items-center rounded-full glass-pill text-[var(--color-subtle)] disabled:opacity-40'}>
          {done ? <Check size={22} strokeWidth={3} /> : <span>○</span>}
        </button>
      </div>
    </li>
  );
}
