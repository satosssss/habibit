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
 * (the check carries the state) and progress rows keep a 55% floor so the white
 * text stays readable on a fresh, empty day — the ring and the x/y subtext are
 * the authoritative progress.
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
    <li className="relative isolate overflow-hidden rounded-3xl"
        style={{ background: rgba(habit.color, 0.2) }}>
      <div data-testid="habit-fill"
           className="absolute inset-y-0 left-0"
           style={{ width: `${Math.round(fill * 100)}%`, background: habit.color, transition: 'width 300ms ease' }} />
      <div className="relative flex items-center gap-3 px-3 py-2.5 xl:gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/25">
          <Icon size={20} color="#fff" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white drop-shadow-sm">{habit.name}</p>
          <p className="truncate text-xs text-white/90 drop-shadow-sm">{subtext(habit, v)}</p>
        </div>

        <FlameBadge count={streak} className="absolute right-3 top-1.5 text-white" />

        {habit.type === 'boolean' && (
          <button type="button"
                  aria-label={done ? `Mark ${habit.name} not done` : `Mark ${habit.name} done`}
                  onClick={onToggle}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white shadow">
            {done ? <Check size={22} color={habit.color} strokeWidth={3} /> : <span className="text-slate-400">○</span>}
          </button>
        )}

        {habit.type === 'quantity' && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" aria-label={`Remove one ${habit.unit || 'unit'}`}
                    disabled={v <= 0}
                    onClick={() => onStep(-1)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/85 disabled:opacity-40">
              <Minus size={16} color={habit.color} />
            </button>
            <button type="button" aria-label={`Add one ${habit.unit || 'unit'}`}
                    disabled={v >= habit.target}
                    onClick={() => onStep(1)}
                    className="grid h-10 w-10 place-items-center rounded-full bg-white shadow disabled:opacity-40">
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
              {done ? <Check size={18} color="#fff" strokeWidth={3} /> : <Plus size={18} color="#fff" />}
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
                <Check size={16} color="#fff" strokeWidth={3} />
              ) : (
                <span className="text-[10px] font-bold text-white">{Math.floor(ratio * 100)}</span>
              )}
            </ProgressRing>
          </button>
        )}
      </div>
    </li>
  );
}
