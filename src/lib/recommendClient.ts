import { isPhone, onDeviceStatus, onDeviceSuggestions, type OnDeviceStatus } from './onDeviceAI';
import { buildRecommendationPrompt, type PromptHistory } from './recommendPrompt';
import { normalizeSuggestions } from './recommendations';
import type { HabitSuggestion, Profile } from './types';

export interface GenerateResult {
  suggestions: HabitSuggestion[];
  source: 'on-device' | 'server';
  deviceStatus: OnDeviceStatus;
}

/** Test seams: every side effect is injectable, nothing is module-global. */
export interface GenerateDeps {
  status?: () => Promise<OnDeviceStatus>;
  phone?: () => boolean;
  runDevice?: (input: { system: string; user: string }) => Promise<HabitSuggestion[]>;
  runServer?: (body: unknown) => Promise<HabitSuggestion[]>;
}

/** Only the answer surface plus counts crosses the wire (spec R5). */
export function requestPayload(profile: Profile, history: PromptHistory) {
  return {
    profile: {
      lifestyle: profile.lifestyle,
      goals: profile.goals,
      challenges: profile.challenges,
      preferences: profile.preferences,
    },
    history,
  };
}

async function postRecommend(body: unknown): Promise<HabitSuggestion[]> {
  const response = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null) as
    { suggestions?: unknown; error?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error || 'Could not generate suggestions.');
  }
  const suggestions = normalizeSuggestions(data?.suggestions);
  if (suggestions.length === 0) throw new Error('No usable suggestions came back.');
  return suggestions;
}

/**
 * Spec R4: on-device first on a phone when the model is ready, server
 * otherwise. Any device failure (not ready, timeout, unparseable) falls through
 * to the server rather than dead-ending, and the last error is surfaced only
 * when both paths fail.
 */
export async function generateSuggestions(
  { profile, history }: { profile: Profile; history: PromptHistory },
  deps: GenerateDeps = {},
): Promise<GenerateResult> {
  const status = await (deps.status ?? onDeviceStatus)();
  const phone = (deps.phone ?? isPhone)();

  if (phone && status === 'available') {
    try {
      const prompt = buildRecommendationPrompt({ profile, history, format: 'json' });
      const suggestions = await (deps.runDevice ?? onDeviceSuggestions)(prompt);
      if (suggestions.length) return { suggestions, source: 'on-device', deviceStatus: status };
    } catch {
      // Fall through to the server: a slow or broken local model must not block.
    }
  }

  const suggestions = await (deps.runServer ?? postRecommend)(requestPayload(profile, history));
  return { suggestions, source: 'server', deviceStatus: status };
}
