'use client';

import { Settings, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applyTheme, getThemePref, type ThemePref } from '@/lib/theme';
import { Sheet } from './Sheet';

// The drawer offers a light/dark toggle only; System stays in Settings'
// segmented control (spec §9).
const OPTIONS: readonly ThemePref[] = ['light', 'dark'];

export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pref, setPref] = useState<ThemePref>('system');

  // One-time client hydration of the stored preference (localStorage is not SSR-safe).
  useEffect(() => { setPref(getThemePref()); }, []);

  return (
    <Sheet open={open} onClose={onClose} title="Menu">
      <nav aria-label="Menu" className="glass-menu flex flex-col gap-3 p-3">
        <button type="button"
                onClick={() => { router.push('/challenges'); onClose(); }}
                className="flex items-center gap-3 rounded-2xl bg-[var(--color-muted)] px-3 py-2.5 text-sm font-medium">
          <Trophy size={18} />
          Challenges
        </button>
        <button type="button"
                onClick={() => { router.push('/settings'); onClose(); }}
                className="flex items-center gap-3 rounded-2xl bg-[var(--color-muted)] px-3 py-2.5 text-sm font-medium">
          <Settings size={18} />
          Settings
        </button>
        <div className="inline-flex w-fit rounded-2xl border border-[var(--color-line)] p-1">
          {OPTIONS.map((option) => (
            <button key={option} type="button" aria-pressed={pref === option}
                    onClick={() => { setPref(option); applyTheme(option); }}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold capitalize ${
                      pref === option ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'text-[var(--color-subtle)]'
                    }`}>
              {option}
            </button>
          ))}
        </div>
      </nav>
    </Sheet>
  );
}
