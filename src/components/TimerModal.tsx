'use client';

import { Pause, Play, Plus, Minus, RotateCcw, SkipForward, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { putEntry } from '@/lib/repo';
import type { Habit } from '@/lib/types';
import { FlameBadge } from './FlameBadge';
import { Sheet } from './Sheet';

function clock(total: number): string {
  const remaining = Math.max(0, total);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerModal({
  habit, initialSeconds, streak, date, onClose, onComplete,
}: {
  habit: Habit;
  initialSeconds: number;
  streak: number;
  date: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [duration, setDuration] = useState(habit.target || 600);
  const [elapsed, setElapsed] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const completed = useRef(false);

  // The app's only setInterval: created when running, always cleared on
  // unmount or when `running`/`duration` change.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsed((e) => Math.min(e + 1, duration));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, duration]);

  useEffect(() => {
    if (!running || completed.current || elapsed < duration) return;
    completed.current = true;
    setRunning(false);
    void putEntry(habit.id, date, habit.target);   // spec §6: value = target
    onComplete();
  }, [elapsed, duration, running, habit.id, habit.target, date, onComplete]);

  // Spec §6: closing mid-run keeps the elapsed seconds in the entry, so
  // reopening the modal resumes where it left off.
  const close = useCallback(() => {
    if (!completed.current && elapsed !== initialSeconds) void putEntry(habit.id, date, elapsed);
    onClose();
  }, [elapsed, initialSeconds, habit.id, date, onClose]);

  const remaining = Math.max(0, duration - elapsed);
  const ratio = duration > 0 ? elapsed / duration : 0;

  return (
    <Sheet open onClose={close} title={habit.name} dark>
      <p className="mb-4 text-center text-xs text-white/60">{habit.name} timer</p>

      <div className="relative mx-auto grid h-56 w-56 place-items-center">
        <div className="absolute inset-0 rounded-full"
             style={{ background: `conic-gradient(${habit.color} ${ratio * 360}deg, #2a2a33 0deg)` }} />
        <div className="absolute inset-3 rounded-full bg-[#111116]" />
        <div className="relative text-center">
          <FlameBadge count={streak} className="justify-center text-white/80" />
          <p className="text-4xl font-bold tabular-nums text-white">{clock(remaining)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button type="button" aria-label="Decrease duration"
                onClick={() => setDuration((d) => Math.max(60, d - 60))}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white">
          <Minus size={18} />
        </button>
        <button type="button" aria-label="Increase duration"
                onClick={() => setDuration((d) => d + 60)}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white">
          <Plus size={18} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" aria-label="Skip" onClick={() => { setRunning(false); close(); }}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
          <SkipForward size={16} />
        </button>
        <button type="button" aria-label="Undo minute" onClick={() => setElapsed((e) => Math.max(0, e - 60))}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
          <Undo2 size={16} />
        </button>
        <button type="button" aria-label="Reset timer"
                onClick={() => { setElapsed(0); completed.current = false; }}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
          <RotateCcw size={16} />
        </button>
        <button type="button" aria-label="+5 minutes" onClick={() => setDuration((d) => d + 300)}
                className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white"
                style={{ background: habit.color }}>
          +5 minutes
        </button>
      </div>

      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-white"
        style={{ background: habit.color }}
      >
        {running ? <Pause size={18} /> : <Play size={18} />}
        {running ? 'Pause' : 'Start timer'}
      </button>
    </Sheet>
  );
}
