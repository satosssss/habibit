'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getProfile } from '@/lib/repo';

/**
 * Accounts spec D5: the server cannot know whether this device has a profile,
 * so `/welcome` is the single client-side fork after sign-in. It lives at its
 * own route so that both branches are ordinary navigations and no screen has
 * to render "maybe onboarding" HTML.
 */
export function WelcomeGate() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    void getProfile()
      .catch(() => null)          // unreadable store means "no profile yet"
      .then((profile) => {
        if (alive) router.replace(profile ? '/home' : '/onboarding');
      });
    return () => { alive = false; };
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <p role="status" className="text-sm text-[var(--color-subtle)]">Opening Habibit…</p>
    </main>
  );
}
