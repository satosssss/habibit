'use client';

import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { profileSummary } from '@/lib/profile';
import { getProfile } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';

/**
 * Accounts spec R2/R3: Settings shows what the device remembers and links back
 * to the same onboarding screen for edits. Nothing here writes.
 */
export function ProfilePanel() {
  const profile = useLiveQuery(() => getProfile(), []);

  return (
    <section className="mt-6 glass-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
        <UserRound size={14} aria-hidden /> Profile
      </h2>

      {profile === undefined ? (
        <p className="text-sm text-[var(--color-subtle)]">Loading…</p>
      ) : !profile ? (
        <>
          <p className="text-sm">No profile on this device yet. Habit ideas need one.</p>
          <Link href="/onboarding" className="mt-3 inline-flex min-h-10 items-center btn-primary px-4 py-2.5 text-sm">
            Set up your profile
          </Link>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-1 text-sm">
            {profileSummary(profile).map((line) => <li key={line}>{line}</li>)}
          </ul>
          {profile.skipped && (
            <p className="mt-2 text-xs text-[var(--color-subtle)]">
              You skipped setup — add your goals for better ideas.
            </p>
          )}
          <Link href="/onboarding" className="mt-3 inline-flex min-h-10 items-center btn-glass px-4 py-2.5 text-sm font-semibold">
            Edit profile
          </Link>
        </>
      )}
    </section>
  );
}
