import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('PWA manifest (account spec R8)', () => {
  it('installs standalone at /home with the token colours', () => {
    const data = manifest();
    expect(data.name).toBe('Habibit');
    expect(data.short_name).toBe('Habibit');
    expect(data.start_url).toBe('/home');
    expect(data.scope).toBe('/');
    expect(data.display).toBe('standalone');
    expect(data.background_color).toBe('#f0ebe3');
    expect(data.theme_color).toBe('#f59e0b');
  });

  it('ships 192, 512 and a maskable icon', () => {
    const icons = manifest().icons ?? [];
    expect(icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }),
      expect.objectContaining({ src: '/icons/maskable-512.png', sizes: '512x512', purpose: 'maskable' }),
    ]));
  });
});
