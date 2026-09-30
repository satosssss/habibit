'use client';

import { useEffect, useState } from 'react';
import { applyTheme, getThemePref, type ThemePref } from '@/lib/theme';

const OPTIONS: ThemePref[] = ['system', 'light', 'dark'];

export function ThemePanel() {
  const [pref, setPref] = useState<ThemePref>('system');

  // One-time client hydration of the stored preference (localStorage is not SSR-safe).
  useEffect(() => { setPref(getThemePref()); }, []);

  return (
    <section className="mt-6 glass-card p-4 mb-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">Theme</h2>
      <div className="inline-flex rounded-2xl border border-[var(--color-line)] p-1">
        {OPTIONS.map((option) => (
          <button key={option} type="button" aria-pressed={pref === option}
                  onClick={() => { setPref(option); applyTheme(option); }}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                    pref === option ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]' : 'text-[var(--color-subtle)]'
                  }`}>
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}
