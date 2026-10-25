'use client';

import { Trophy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { challengeTitle } from '@/lib/challenges';
import { dismissChallengeWin, useChallengeWin } from '@/lib/challengeWin';

/**
 * Challenges spec §UX: the one deliberate moment of delight. A non-portaled
 * glass overlay over a soft scrim; the polite region announces the win, Done
 * (and Escape) dismiss immediately, and the timer auto-dismisses. Reduced
 * motion gets the static card — toast-in only ever runs under motion-safe.
 */
export function ChallengeWinOverlay() {
  const c = useChallengeWin();
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!c) return;
    doneRef.current?.focus();                       // focus lands on the dismiss action
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissChallengeWin(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [c]);

  if (!c) return null;
  return (
    <div role="status" aria-live="polite" data-testid="challenge-win"
         className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div data-testid="challenge-win-card"
           className="glass-heavy w-full max-w-sm rounded-[28px] p-8 text-center motion-safe:animate-[toast-in_200ms_ease-out]">
        <Trophy size={44} className="mx-auto mb-3 text-[var(--color-accent)]" aria-hidden />
        <h2 className="mb-1 text-xl font-extrabold">Challenge complete!</h2>
        <p className="mb-1 text-sm font-semibold text-[var(--color-fg)]">
          {challengeTitle(c.type)} — {c.scopeLabel}
        </p>
        <p className="mb-5 text-xs text-[var(--color-subtle)]">Won</p>
        <button ref={doneRef} type="button" onClick={dismissChallengeWin}
                className="btn-primary min-h-11 w-full text-sm">
          Done
        </button>
      </div>
    </div>
  );
}
