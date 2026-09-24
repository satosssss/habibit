'use client';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'habibit:theme';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

export function getThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePref): void {
  const dark = pref === 'dark' || (pref === 'system' && prefersDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePref = pref;
  try { localStorage.setItem(KEY, pref); } catch { /* private mode: session only */ }
}
