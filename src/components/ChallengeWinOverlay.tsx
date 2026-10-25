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
 * The region is click-through (house CompletionToast posture): taps always
 * reach the list behind it; only the card itself is interactive.
 */
export function ChallengeWinOverlay() {
  const c = useChallengeWin();
  const doneRef = useRef<HTMLButtonElement>(null);
  // The opener to restore on close. Captured on every open transition: on a
  // replace-once second win the previous cleanup has already refocused the
  // genuine opener and cleared this ref, so the re-capture below picks the
  // opener again — never the first overlay's dead Done button.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!c) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    doneRef.current?.focus();                       // focus lands on the dismiss action
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissChallengeWin(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Spec R5: focus returns to the opener on close (Sheet.tsx pattern).
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus();
    };
  }, [c]);

  if (!c) return null;
  return (
    <div role="status" aria-live="polite" data-testid="challenge-win"
         className="pointer-events-none fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div data-testid="challenge-win-card"
           className="glass-heavy pointer-events-auto w-full max-w-sm rounded-[28px] p-8 text-center motion-safe:animate-[toast-in_200ms_ease-out]">
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
