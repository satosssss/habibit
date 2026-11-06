'use client';

import { LogIn, ShieldCheck } from 'lucide-react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Accounts spec R1: one button, one action. Auth.js owns the redirect; the
 * callbackUrl lands on `/welcome`, which decides between onboarding and home
 * because only the device knows whether a profile exists.
 */
export function LoginScreen() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `getSession()` is a plain fetch, so this screen needs no provider; offline
  // it fails and the button simply does not render until the fetch resolves.
  useEffect(() => {
    let alive = true;
    void getSession()
      .then((session) => {
        if (!alive) return;
        if (session?.user) router.replace('/welcome');
        else setReady(true);
      })
      .catch(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [router]);

  // Auth.js appends ?error=... on a failed exchange; reading it in an effect
  // avoids useSearchParams and its Suspense boundary on a static page.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError('Sign-in did not complete. Please try again.');
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn('google', { callbackUrl: '/welcome' });
    } catch {
      setBusy(false);
      setError('Could not start Google sign-in. Check your connection and try again.');
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span aria-hidden className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[var(--color-accent)] text-2xl font-extrabold text-[var(--color-on-accent)]">
            H
          </span>
          <h1 className="text-2xl font-extrabold">Habibit</h1>
          <p className="mt-1 text-sm text-[var(--color-subtle)]">
            Small habits, kept honest.
          </p>
        </div>

        <section className="glass-card p-6">
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy || !ready}
            className="btn-primary w-full gap-2 text-sm"
          >
            <LogIn size={16} aria-hidden />
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>

          {error && (
            <p role="alert" className="mt-3 text-center text-xs text-red-500">
              {error}
            </p>
          )}

          <p className="mt-5 flex items-start gap-2 text-xs text-[var(--color-subtle)]">
            <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              We keep only your name, email and photo from Google. Your habits stay in this
              browser and never reach our servers.
            </span>
          </p>
        </section>
      </div>
    </main>
  );
}
