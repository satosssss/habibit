import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, getThemePref, type ThemePref } from './theme';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePref;
});

describe('theme', () => {
  it('defaults to system', () => {
    expect(getThemePref()).toBe('system');
  });

  it('persists and applies an explicit preference', () => {
    applyTheme('dark');
    expect(getThemePref()).toBe<ThemePref>('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.themePref).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('resolves system against the OS preference', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('dark'),
      media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('falls back cleanly when localStorage throws (private mode)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('denied'); };
    expect(() => applyTheme('dark')).not.toThrow();
    Storage.prototype.setItem = original;
  });
});
