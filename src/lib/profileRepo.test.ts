import { beforeEach, describe, expect, it } from 'vitest';
import { emptyProfile } from './profile';
import {
  clearAll, clearProfile, exportState, getProfile, importState, latestEntryDate, putEntry, putHabit,
  putRecommendations, recommendationHistory, resetToEmpty, saveProfile,
} from './repo';
import { cacheSuggestions } from './recommendations';
import type { Habit } from './types';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3',
  category: 'Morning', intention: 'Do Hard Things', type: 'boolean',
  target: 1, unit: '', frequency: [0, 1, 2, 3, 4, 5, 6], order: 0,
  createdAt: Date.parse('2026-10-01T08:00:00'), ...over,
});

const suggestion = {
  id: 's1', name: 'Walk', reason: 'Movement', suggestedTime: '13:00', firstStep: '5 minutes',
};

beforeEach(async () => { await clearAll(); });

describe('profile store (account spec R2)', () => {
  it('is empty until the first save', async () => {
    expect(await getProfile()).toBeNull();
  });

  it('creates the single me row on first save and merges later saves', async () => {
    const first = await saveProfile({ goals: { items: ['Move daily'] }, accountEmail: 'a@example.com' }, 1_000);
    expect(first.id).toBe('me');
    expect(first.goals.items).toEqual(['Move daily']);
    expect(first.accountEmail).toBe('a@example.com');

    const second = await saveProfile({ lifestyle: { wakeTime: '06:00' } }, 2_000);
    expect(second.goals.items).toEqual(['Move daily']);      // untouched
    expect(second.accountEmail).toBe('a@example.com');       // untouched
    expect(second.updatedAt).toBe(2_000);

    expect(await getProfile()).toEqual(second);
  });

  it('clears the recommendation cache when answers change, not on account saves', async () => {
    await saveProfile({ goals: { items: ['Move daily'] } }, 1_000);
    await putRecommendations(cacheSuggestions([suggestion], 'server', '2026-11-01', 2_000));
    expect((await getProfile())!.recommendations).not.toBeNull();

    const accountSave = await saveProfile({ accountEmail: 'b@example.com' }, 3_000);
    expect(accountSave.recommendations).not.toBeNull();
    expect(accountSave.updatedAt).toBe(3_000);               // cache write did not stamp

    const answerSave = await saveProfile({ challenges: 'No time' }, 4_000);
    expect(answerSave.recommendations).toBeNull();
  });

  it('deletes the row', async () => {
    await saveProfile({}, 1_000);
    await clearProfile();
    expect(await getProfile()).toBeNull();
  });
});

describe('latestEntryDate', () => {
  it('is null with no entries and the newest date otherwise', async () => {
    expect(await latestEntryDate()).toBeNull();
    await putHabit(habit());
    await putEntry('h1', '2026-10-30', 1);
    await putEntry('h1', '2026-11-02', 1);
    expect(await latestEntryDate()).toBe('2026-11-02');
  });
});

describe('recommendationHistory', () => {
  it('counts completions and names from the last 14 days only', async () => {
    await putHabit(habit());
    await putEntry('h1', '2026-10-01', 1);   // outside the window
    await putEntry('h1', '2026-11-04', 1);
    await putEntry('h1', '2026-11-05', 0);

    const history = await recommendationHistory('2026-11-05');
    expect(history.activeDays).toBe(2);
    expect(history.completions).toBe(1);
    expect(history.ratePct).toBe(50);
    expect(history.habitNames).toEqual(['Meditate']);
  });

  it('reports zero rather than a fake percentage with no entries', async () => {
    const history = await recommendationHistory('2026-11-05');
    expect(history).toMatchObject({ activeDays: 0, completions: 0, ratePct: 0 });
  });
});

describe('export / import / reset include the profile', () => {
  it('exports the profile row', async () => {
    await saveProfile({ goals: { items: ['Move daily'] }, accountEmail: 'a@example.com' }, 1_000);
    const state = await exportState();
    expect(state.profile).toMatchObject({ id: 'me', accountEmail: 'a@example.com' });
  });

  it('round-trips a profile through import', async () => {
    await saveProfile({ goals: { items: ['Sleep better'] } }, 1_000);
    const state = await exportState();

    await resetToEmpty();
    expect(await getProfile()).toBeNull();

    await importState(state);
    const restored = await getProfile();
    expect(restored?.goals.items).toEqual(['Sleep better']);
  });

  it('clears a stale profile when a legacy export has none', async () => {
    await saveProfile({ goals: { items: ['Old'] } }, 1_000);
    await importState({ habits: [], entries: [] });
    expect(await getProfile()).toBeNull();
  });

  it('resetToEmpty clears the profile and claims the seed marker', async () => {
    await saveProfile({}, 1_000);
    await resetToEmpty();
    expect(await getProfile()).toBeNull();
    expect((await exportState()).habits).toEqual([]);
  });
});

describe('emptyProfile is what a skipped profile looks like', () => {
  it('keeps skipped true and zeroed timestamps separate from answers', () => {
    const skipped = emptyProfile(0);
    expect(skipped.skipped).toBe(false);      // the flag is set by the save, not the defaults
    expect(skipped.goals.items).toEqual(['']);
  });
});
