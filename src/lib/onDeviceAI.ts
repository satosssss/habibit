import { DEVICE_APPEND } from './recommendPrompt';
import { normalizeSuggestions } from './recommendations';
import type { HabitSuggestion } from './types';

export type OnDeviceStatus = 'available' | 'downloadable' | 'unavailable';

interface PromptSession {
  prompt(text: string): Promise<string>;
  destroy?: () => void;
}

interface PromptApi {
  availability?: () => Promise<string>;
  capabilities?: () => Promise<{ available?: string }>;
  create: (options?: Record<string, unknown>) => Promise<PromptSession>;
}

/**
 * Spec R7: Chrome exposes the Prompt API as `LanguageModel` (2025 shape) and,
 * in older builds, as `ai.languageModel`. Both are optional globals, so the
 * detection has to be defensive and must never throw.
 */
function promptApi(): PromptApi | null {
  const scope = globalThis as unknown as {
    LanguageModel?: PromptApi;
    ai?: { languageModel?: PromptApi };
  };
  if (typeof scope.LanguageModel?.create === 'function') return scope.LanguageModel;
  if (typeof scope.ai?.languageModel?.create === 'function') return scope.ai.languageModel;
  return null;
}

/** Feature detection only: never starts a model download. */
export async function onDeviceStatus(): Promise<OnDeviceStatus> {
  const api = promptApi();
  if (!api) return 'unavailable';
  try {
    if (typeof api.availability === 'function') {
      const state = await api.availability();
      if (state === 'available') return 'available';
      if (state === 'downloadable' || state === 'downloading') return 'downloadable';
      return 'unavailable';
    }
    if (typeof api.capabilities === 'function') {
      const { available } = await api.capabilities();
      if (available === 'readily') return 'available';
      if (available === 'after-download') return 'downloadable';
    }
  } catch {
    return 'unavailable';
  }
  return 'unavailable';
}

/** Spec R7: on-device is a phone feature; desktop always uses the server. */
export function isPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  const coarse = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || coarse;
}

/** Tolerant JSON extraction: fenced blocks and stray prose are common. */
export function extractJson(raw: string): unknown {
  const objectStart = raw.indexOf('{');
  const arrayStart = raw.indexOf('[');
  const wantsArray = arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart);

  if (wantsArray) {
    const end = raw.lastIndexOf(']');
    if (end > arrayStart) {
      try { return JSON.parse(raw.slice(arrayStart, end + 1)); } catch { /* fall through */ }
    }
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* fall through */ }
  }

  if (!wantsArray) {
    const arrayEnd = raw.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try { return JSON.parse(raw.slice(arrayStart, arrayEnd + 1)); } catch { /* fall through */ }
    }
  }
  return null;
}

function withTimeout<T>(value: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    value.then(
      (result) => { clearTimeout(timer); resolve(result); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * Runs one prompt in a throwaway session. Returns normalised suggestions or
 * throws; the caller falls back to the server on any failure (spec R4).
 */
export async function onDeviceSuggestions(
  input: { system: string; user: string },
  timeoutMs = 45_000,
): Promise<HabitSuggestion[]> {
  const api = promptApi();
  if (!api) throw new Error('On-device AI is not available in this browser.');

  const session = await api.create({ systemPrompt: input.system, temperature: 0.7, topK: 3 });
  try {
    const raw = await withTimeout(
      session.prompt(`${input.user}${DEVICE_APPEND}`),
      timeoutMs,
      'On-device AI took too long.',
    );
    const parsed = extractJson(raw) as { suggestions?: unknown } | unknown[] | null;
    const list = Array.isArray(parsed) ? parsed : parsed?.suggestions;
    const suggestions = normalizeSuggestions(list);
    if (suggestions.length === 0) throw new Error('On-device AI returned no usable habits.');
    return suggestions;
  } finally {
    session.destroy?.();
  }
}
