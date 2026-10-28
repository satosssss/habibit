'use client';

import { Pause, Play, Plus, Minus, RotateCcw, SkipForward, Square, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateChallenges, putEntry } from '@/lib/repo';
import { celebrateWins } from '@/lib/challengeWin';
import { reportWriteError } from '@/lib/writeError';
import { celebrateIfCompleted } from '@/lib/completionToast';
import type { Habit } from '@/lib/types';
import { FlameBadge } from './FlameBadge';
import { Sheet } from './Sheet';

function clock(total: number): string {
  const remaining = Math.max(0, total);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Spec §6 says only "±5 when held"; these are the chosen hold timings —
// first repeat after 500 ms, then one every 250 ms.
const HOLD_DELAY_MS = 500;
const HOLD_REPEAT_MS = 250;

type Stage = 'idle' | 'running' | 'paused';

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
  // Spec R1 §2.2: the session can never run longer than the habit's target.
  // max(60, …) keeps a corrupt legacy target of 0 from collapsing the floor.
  const cap = Math.max(60, habit.target);
  const clampDuration = useCallback((d: number) => Math.min(cap, Math.max(60, d)), [cap]);
  const [duration, setDuration] = useState(() => clampDuration(habit.target || 600));
  const [elapsed, setElapsed] = useState(initialSeconds);
  const [stage, setStage] = useState<Stage>('idle');
  const running = stage === 'running';
  const completed = useRef(false);

  // Latest committed elapsed, read by the unmount-persist cleanup below.
  const elapsedRef = useRef(elapsed);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  // The entry value this session last wrote (close/Stop), so the unmount
  // cleanup never writes the same seconds twice.
  const persistedRef = useRef<number | null>(null);

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
    setStage('idle');
    // Spec R1.2.2: honest accounting — log the session actually run
    // (a 14-minute session on a 15-minute habit writes 840, not the target).
    const written = Math.min(elapsed, duration);
    void putEntry(habit.id, date, written)
      .then(() => celebrateIfCompleted(habit, initialSeconds, written))  // A2: after success only
      .then(() => evaluateChallenges())
      .then(celebrateWins)
      .catch(reportWriteError);
    onComplete();
  }, [elapsed, duration, running, habit.id, date, initialSeconds, onComplete]);

  // Spec §6: closing mid-run keeps the elapsed seconds in the entry, so
  // reopening the modal resumes where it left off.
  const close = useCallback(() => {
    if (!completed.current && elapsed !== initialSeconds) {
      persistedRef.current = elapsed;
      void putEntry(habit.id, date, elapsed).catch(reportWriteError);
    }
    onClose();
  }, [elapsed, initialSeconds, habit.id, date, onClose]);

  // Spec §6: a route change unmounts the modal without close(); the session's
  // seconds still land in the entry — unless close/Stop already wrote them or
  // the session completed (which already wrote min(elapsed, duration)).
  useEffect(() => () => {
    if (completed.current) return;
    const value = elapsedRef.current;
    if (value === initialSeconds || value === persistedRef.current) return;
    void putEntry(habit.id, date, value).catch(reportWriteError);
  }, [habit.id, date, initialSeconds]);

  // Spec §6 "±5 when held": a recursive setTimeout chain — a chain is not a
  // setInterval, so the single interval stays reserved for the ring tick.
  const repeatRef = useRef<number | null>(null);
  const stopRepeat = useCallback(() => {
    if (repeatRef.current !== null) {
      window.clearTimeout(repeatRef.current);
      repeatRef.current = null;
    }
  }, []);
  useEffect(() => stopRepeat, [stopRepeat]);   // also cleared on unmount

  const startRepeat = useCallback((dir: 1 | -1) => {
    stopRepeat();
    const step = () => {
      setDuration((d) => clampDuration(d + dir * 300));
      repeatRef.current = window.setTimeout(step, HOLD_REPEAT_MS);
    };
    repeatRef.current = window.setTimeout(step, HOLD_DELAY_MS);
  }, [stopRepeat, clampDuration]);

  const pressedRef = useRef(false);
  // Handlers for the ± steppers: pointerdown steps ±1 immediately and arms
  // the hold-repeat; the trailing click from that same press is swallowed
  // (keyboard activation arrives with no prior press, so its click still steps).
  const stepper = (dir: 1 | -1) => ({
    onPointerDown: () => {
      pressedRef.current = true;
      setDuration((d) => clampDuration(d + dir * 60));
      startRepeat(dir);
    },
    onPointerUp: stopRepeat,
    onPointerLeave: stopRepeat,
    onPointerCancel: stopRepeat,
    onBlur: stopRepeat,
    onClick: () => {
      if (pressedRef.current) { pressedRef.current = false; return; }
      setDuration((d) => clampDuration(d + dir * 60));
    },
  });

  const remaining = Math.max(0, duration - elapsed);
  // Spec R1.2.2: an over-target entry (legacy data) sweeps at most a full
  // circle — never beyond 360deg.
  const ratio = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  // Spec §6: the countdown ring is tick-marked — one tick per minute of the
  // session; each tick depletes (fades out) once the elapsed sweep passes it.
  const tickCount = Math.max(1, Math.round(duration / 60));

  return (
    <Sheet open onClose={close} title={habit.name} dark centerFrom="lg">
      <p className="mb-4 text-center text-xs text-white/60">{habit.name} timer</p>

      <div className="relative mx-auto grid h-56 w-56 place-items-center">
        <div className="absolute inset-0 rounded-full"
             style={{ background: `conic-gradient(${habit.color} ${ratio * 360}deg, #2a2a33 0deg)` }} />
        <div aria-hidden="true" data-tick-count={tickCount} className="absolute inset-0">
          {Array.from({ length: tickCount }, (_, i) => {
            const depleted = elapsed > ((i + 0.5) / tickCount) * duration;
            return (
              <span key={i} data-tick={i} data-depleted={depleted ? 'true' : 'false'}
                    className="absolute left-1/2 top-1/2 h-3 w-0.5 rounded-full bg-white/70 transition-opacity"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${((i + 0.5) / tickCount) * 360}deg) translateY(-106px)`,
                      opacity: depleted ? 0 : 1,
                    }} />
            );
          })}
        </div>
        <div className="absolute inset-3 rounded-full bg-[#111116]" />
        <div className="relative text-center">
          <FlameBadge count={streak} className="justify-center text-white/80" />
          <p className="text-4xl font-bold tabular-nums text-white">{clock(remaining)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button type="button" aria-label="Decrease duration" {...stepper(-1)}
                disabled={duration <= 60}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white disabled:opacity-40">
          <Minus size={18} aria-hidden />
        </button>
        <button type="button" aria-label="Increase duration" {...stepper(1)}
                disabled={duration >= cap}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white disabled:opacity-40">
          <Plus size={18} aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" aria-label="Skip" onClick={() => { setStage('idle'); close(); }}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
          <SkipForward size={16} aria-hidden />
        </button>
        <button type="button" aria-label="Undo minute" onClick={() => setElapsed((e) => Math.max(0, e - 60))}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
          <Undo2 size={16} aria-hidden />
        </button>
        <button type="button" aria-label="Reset timer"
                onClick={() => { setElapsed(0); completed.current = false; }}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white">
          <RotateCcw size={16} aria-hidden />
        </button>
        <button type="button" aria-label="+5 minutes"
                disabled={duration >= cap}
                onClick={() => setDuration((d) => clampDuration(d + 300))}
                className="flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: habit.color }}>
          +5 minutes
        </button>
      </div>

      {/* Spec §6: full-width Start timer → Pause → Stop. Pause holds elapsed in
          memory; Stop commits it to the entry and ends the session (close —
          reopening the modal resumes, §6 L163). */}
      <button
        type="button"
        onClick={() => {
          if (stage === 'idle') setStage('running');
          else if (stage === 'running') setStage('paused');
          else { setStage('idle'); close(); }
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-bold text-white"
        style={{ background: habit.color }}
      >
        {stage === 'running' ? <Pause size={18} aria-hidden />
          : stage === 'paused' ? <Square size={18} aria-hidden />
          : <Play size={18} aria-hidden />}
        {stage === 'idle' ? 'Start timer' : stage === 'running' ? 'Pause' : 'Stop'}
      </button>
    </Sheet>
  );
}
