'use client';

import { BarChart3, CalendarCheck, Flame, Settings, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ensureDb } from '@/lib/db';
import { clampLegacyEntries, pruneOrphans } from '@/lib/repo';
import { seedIfEmpty } from '@/lib/seed';
import { reportWriteError } from '@/lib/writeError';
import { CompletionToast } from './CompletionToast';
import { BackgroundScene } from './BackgroundScene';
import { WriteErrorBanner } from './WriteErrorBanner';

const TABS = [
  { href: '/today', label: 'Today', Icon: CalendarCheck },
  { href: '/stats', label: 'Stats', Icon: BarChart3 },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const;

const linkClass = (active: boolean) =>
  [
    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
    active
      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
      : 'text-[var(--color-subtle)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)]',
  ].join(' ');

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    void seedIfEmpty().catch(reportWriteError);   // idempotent: returns immediately once habits exist
    void ensureDb().then((s) => {
      setDegraded(s === 'degraded');
      void pruneOrphans().catch(reportWriteError);   // stray entries never reach stats
      void clampLegacyEntries().catch(reportWriteError);   // spec R1 §2.3 boot migration
    }).catch(reportWriteError);
  }, []);

  return (
    <div className="min-h-dvh md:flex">
      <BackgroundScene />
      {/* Tablet icon rail / desktop sidebar */}
      <nav
        aria-label="Primary"
        className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 border-r border-[var(--color-line)] p-3 md:flex md:w-[72px] xl:w-[240px] glass-nav"
      >
        {/* Wordmark only in the labelled sidebar; flame only in the icon rail */}
        <div className="mb-4 hidden items-center gap-2 px-2 xl:flex">
          <Flame className="text-[var(--color-accent)]" size={22} />
          <span className="font-display text-lg font-extrabold tracking-tight">Habibit</span>
        </div>
        <div className="mb-4 grid place-items-center xl:hidden">
          <Flame className="text-[var(--color-accent)]" size={22} />
        </div>
        {TABS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}
                className={linkClass(isActive(href))} title={label}>
            <Icon size={20} />
            <span className="hidden xl:inline">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <WriteErrorBanner />
        <CompletionToast />
        {degraded && (
          <p role="alert"
             className="m-3 flex items-start gap-2 rounded-2xl glass-card px-4 py-3 text-sm">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-ink)]" />
            <span>Storage is unavailable (private browsing?), so changes will be lost when you close this tab.</span>
          </p>
        )}
        {children}
      </div>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Primary"
           className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-line)] md:hidden glass-nav">
        {TABS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium ${
                  isActive(href) ? 'text-[var(--color-accent-ink)]' : 'text-[var(--color-subtle)]'
                }`}>
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
