'use client';

import { LogOut, ShieldCheck, TriangleAlert } from 'lucide-react';
import { getSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getProfile } from '@/lib/repo';

interface Account {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Accounts spec R1/D4: shows only the three fields the session carries and the
 * switch warning. `getSession()` is a plain fetch, so this panel needs no
 * provider and degrades to "unavailable offline" rather than throwing.
 */
export function AccountPanel() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [storedEmail, setStoredEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([getSession().catch(() => null), getProfile().catch(() => null)])
      .then(([session, profile]) => {
        if (!alive) return;
        setAccount(session?.user ?? null);
        setStoredEmail(profile?.accountEmail ?? null);
      });
    return () => { alive = false; };
  }, []);

  const switched = Boolean(
    account?.email && storedEmail && account.email !== storedEmail,
  );

  return (
    <section className="mt-6 glass-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
        <ShieldCheck size={14} aria-hidden /> Account
      </h2>

      {account === undefined ? (
        <p className="text-sm text-[var(--color-subtle)]">Loading…</p>
      ) : account ? (
        <div className="flex items-center gap-3">
          {account.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google avatar, no Image config needed
            <img src={account.image} alt="" width={40} height={40} referrerPolicy="no-referrer"
                 className="h-10 w-10 rounded-full border border-[var(--color-line)]" />
          ) : (
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-accent)] font-bold text-[var(--color-on-accent)]">
              {(account.name ?? account.email ?? '?').slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            {account.name && <p className="truncate text-sm font-semibold">{account.name}</p>}
            {account.email && <p className="truncate text-xs text-[var(--color-subtle)]">{account.email}</p>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-subtle)]">
          Account details are unavailable offline. You are still signed in on this device.
        </p>
      )}

      {switched && (
        <div role="status"
             className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="flex items-start gap-2">
            <TriangleAlert size={14} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              This browser&apos;s habits were set up with <strong>{storedEmail}</strong>. You are
              signed in as <strong>{account?.email}</strong>, and this device shares one set of
              data. Export and reset your data below to start clean.
            </span>
          </p>
        </div>
      )}

      <button type="button" onClick={() => void signOut({ callbackUrl: '/login' })}
              className="mt-3 flex min-h-10 items-center gap-2 btn-glass px-4 py-2.5 text-sm font-semibold">
        <LogOut size={15} aria-hidden /> Sign out
      </button>
      <p className="mt-2 text-xs text-[var(--color-subtle)]">
        Signing out leaves your habits on this device.
      </p>
    </section>
  );
}
