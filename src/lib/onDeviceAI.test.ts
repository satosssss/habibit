import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractJson, isPhone, onDeviceStatus, onDeviceSuggestions } from './onDeviceAI';

interface FakeModel {
  availability?: () => Promise<string>;
  capabilities?: () => Promise<{ available?: string }>;
  create: ReturnType<typeof vi.fn>;
}

const setModel = (model: FakeModel | null) => {
  (globalThis as unknown as { LanguageModel?: FakeModel }).LanguageModel = model ?? undefined;
};

const withUserAgent = (ua: string, coarse = false) => {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
  window.matchMedia = ((query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

afterEach(() => {
  setModel(null);
  vi.useRealTimers();
});

describe('onDeviceStatus (spec R7)', () => {
  it('is unavailable without the API', async () => {
    expect(await onDeviceStatus()).toBe('unavailable');
  });

  it('reads the modern availability() states', async () => {
    for (const [state, expected] of [
      ['available', 'available'],
      ['downloadable', 'downloadable'],
      ['downloading', 'downloadable'],
      ['unavailable', 'unavailable'],
    ] as const) {
      setModel({ availability: async () => state, create: vi.fn() });
      expect(await onDeviceStatus()).toBe(expected);
    }
  });

  it('falls back to the legacy capabilities() shape', async () => {
    setModel({ capabilities: async () => ({ available: 'readily' }), create: vi.fn() });
    expect(await onDeviceStatus()).toBe('available');
    setModel({ capabilities: async () => ({ available: 'after-download' }), create: vi.fn() });
    expect(await onDeviceStatus()).toBe('downloadable');
  });

  it('never throws when detection itself fails', async () => {
    setModel({ availability: async () => { throw new Error('nope'); }, create: vi.fn() });
    expect(await onDeviceStatus()).toBe('unavailable');
  });
});

describe('isPhone', () => {
  it('detects a mobile user agent', () => {
    withUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(isPhone()).toBe(true);
  });

  it('detects a coarse pointer', () => {
    withUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', true);
    expect(isPhone()).toBe(true);
  });

  it('is false on a desktop', () => {
    withUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(isPhone()).toBe(false);
  });
});

describe('extractJson', () => {
  it('tolerates fences and prose', () => {
    expect(extractJson('Here you go:\n```json\n{"suggestions":[{"name":"A"}]}\n```')).toEqual({
      suggestions: [{ name: 'A' }],
    });
    expect(extractJson('[{"name":"A"}]')).toEqual([{ name: 'A' }]);
    expect(extractJson('no json here')).toBeNull();
  });
});

describe('onDeviceSuggestions (spec R7)', () => {
  it('prompts once, normalises, and always destroys the session', async () => {
    const destroy = vi.fn();
    const calls: Array<Record<string, unknown> | undefined> = [];
    const create = vi.fn(async (options?: Record<string, unknown>) => {
      calls.push(options);
      return {
        prompt: async () => '```json\n{"suggestions":[{"name":" Stretch ","reason":"Desk","suggestedTime":"09:00","firstStep":"30s"}]}\n```',
        destroy,
      };
    });
    setModel({ availability: async () => 'available', create });

    const out = await onDeviceSuggestions({ system: 'sys', user: 'usr' });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Stretch');
    expect(create).toHaveBeenCalledOnce();
    expect(calls[0]).toMatchObject({ systemPrompt: 'sys' });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('throws on unusable output and still destroys the session', async () => {
    const destroy = vi.fn();
    setModel({
      availability: async () => 'available',
      create: vi.fn(async () => ({ prompt: async () => 'sorry, no ideas', destroy })),
    });
    await expect(onDeviceSuggestions({ system: 's', user: 'u' })).rejects.toThrow(/no usable habits/i);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('times out instead of hanging the home screen', async () => {
    const destroy = vi.fn();
    setModel({
      availability: async () => 'available',
      create: vi.fn(async () => ({ prompt: () => new Promise<string>(() => {}), destroy })),
    });
    await expect(onDeviceSuggestions({ system: 's', user: 'u' }, 5)).rejects.toThrow(/too long/i);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('throws when the API is missing', async () => {
    await expect(onDeviceSuggestions({ system: 's', user: 'u' })).rejects.toThrow(/not available/i);
  });
});
