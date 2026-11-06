import { describe, expect, it, vi } from 'vitest';
import { emptyProfile, mergeProfile } from './profile';
import { generateSuggestions, requestPayload } from './recommendClient';
import type { PromptHistory } from './recommendPrompt';
import type { HabitSuggestion } from './types';

const profile = mergeProfile(emptyProfile(0), {
  accountEmail: 'private@example.com',
  goals: { items: ['Move daily'] },
  challenges: 'No time',
}, 1);

const history: PromptHistory = {
  activeDays: 3, completions: 5, ratePct: 50, habitNames: ['Meditate'],
};

const suggestion: HabitSuggestion = {
  id: 's1', name: 'Walk', reason: 'Cheap movement', suggestedTime: '13:00', firstStep: '5 minutes',
};

describe('requestPayload (spec R5)', () => {
  it('sends only the answer surface and counts', () => {
    const body = requestPayload(profile, history) as Record<string, unknown> & {
      profile: Record<string, unknown>;
    };
    expect(body.profile).not.toHaveProperty('accountEmail');
    expect(JSON.stringify(body)).not.toContain('private@example.com');
    expect(body.profile.goals).toEqual(profile.goals);
    expect(body.history).toEqual(history);
  });
});

describe('generateSuggestions (spec R4)', () => {
  it('uses the device model on a phone when it is available', async () => {
    const runServer = vi.fn(async () => [suggestion]);
    const result = await generateSuggestions({ profile, history }, {
      status: async () => 'available',
      phone: () => true,
      runDevice: async () => [suggestion],
      runServer,
    });
    expect(result.source).toBe('on-device');
    expect(result.suggestions).toEqual([suggestion]);
    expect(runServer).not.toHaveBeenCalled();
  });

  it('falls back to the server when the device attempt fails', async () => {
    const runServer = vi.fn(async () => [suggestion]);
    const result = await generateSuggestions({ profile, history }, {
      status: async () => 'available',
      phone: () => true,
      runDevice: async () => { throw new Error('model crashed'); },
      runServer,
    });
    expect(result.source).toBe('server');
    expect(runServer).toHaveBeenCalledOnce();
  });

  it('uses the server on desktop even when the model exists', async () => {
    const runDevice = vi.fn(async () => [suggestion]);
    const result = await generateSuggestions({ profile, history }, {
      status: async () => 'available',
      phone: () => false,
      runDevice,
      runServer: async () => [suggestion],
    });
    expect(result.source).toBe('server');
    expect(runDevice).not.toHaveBeenCalled();
  });

  it('surfaces the server error when both paths fail', async () => {
    await expect(generateSuggestions({ profile, history }, {
      status: async () => 'unavailable',
      phone: () => true,
      runServer: async () => { throw new Error('AI is not configured'); },
    })).rejects.toThrow('AI is not configured');
  });
});
