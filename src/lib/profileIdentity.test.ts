import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR_ID, avatarFor, isAvatarId } from './avatars';
import { displayName, emptyProfile, greeting, mergeProfile, normalizeProfile, profileSummary } from './profile';

const NOW = 1_000;

describe('profile identity (onboarding v2)', () => {
  it('defaults to no name and the default avatar', () => {
    const profile = emptyProfile(NOW);
    expect(profile.identity).toEqual({ displayName: '', avatarId: DEFAULT_AVATAR_ID });
  });

  it('trims and caps the display name', () => {
    const merged = mergeProfile(emptyProfile(NOW), {
      identity: { displayName: `  ${'a'.repeat(60)}  ` },
    }, NOW + 1);
    expect(merged.identity.displayName).toHaveLength(40);
    expect(merged.identity.displayName.trim()).toBe(merged.identity.displayName);
  });

  it('rejects an unknown avatar id instead of storing it', () => {
    const merged = mergeProfile(emptyProfile(NOW), {
      identity: { displayName: 'Sam', avatarId: 'not-a-face' },
    }, NOW + 1);
    expect(merged.identity.avatarId).toBe(DEFAULT_AVATAR_ID);
    expect(isAvatarId('not-a-face')).toBe(false);
    expect(avatarFor('not-a-face').id).toBe(DEFAULT_AVATAR_ID);
  });

  it('does not throw away the recommendation cache when only the name changes', () => {
    const normalised = mergeProfile(emptyProfile(NOW), { goals: { items: [] } }, NOW);
    const withCache = {
      ...normalised,
      recommendations: {
        generatedAt: NOW,
        dataThrough: '2026-11-01',
        source: 'server' as const,
        suggestions: [],
      },
    };
    const renamed = mergeProfile(withCache, { identity: { displayName: 'Sam' } }, NOW + 1);
    expect(renamed.recommendations).not.toBeNull();
  });

  it('repairs identity through the import path', () => {
    const repaired = normalizeProfile({
      displayName: 'Legacy',
      identity: { avatarId: 'owl' },
    }, NOW);
    expect(repaired?.identity).toEqual({ displayName: 'Legacy', avatarId: 'owl' });

    const junk = normalizeProfile({ identity: { displayName: 42, avatarId: {} } }, NOW);
    expect(junk?.identity).toEqual({ displayName: '', avatarId: DEFAULT_AVATAR_ID });
  });

  it('greets by time of day and falls back to a name-less greeting', () => {
    const named = mergeProfile(emptyProfile(NOW), { identity: { displayName: 'Sam' } }, NOW);
    expect(greeting(named, 8)).toBe('Good morning, Sam');
    expect(greeting(named, 14)).toBe('Good afternoon, Sam');
    expect(greeting(named, 20)).toBe('Good evening, Sam');
    expect(greeting(emptyProfile(NOW), 8)).toBe('Good morning');
    expect(displayName(named)).toBe('Sam');
  });

  it('mentions the name in the settings summary', () => {
    const named = mergeProfile(emptyProfile(NOW), { identity: { displayName: 'Sam' } }, NOW);
    expect(profileSummary(named)[0]).toBe('Name: Sam');
  });
});
