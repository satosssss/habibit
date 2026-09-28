import { describe, expect, it } from 'vitest';
import { intentionSuggestions } from './labels';

describe('intentionSuggestions', () => {
  it('lists in-use intentions first, deduped case-insensitively in first-seen casing', () => {
    expect(intentionSuggestions(['Study', 'study', ' Be Grateful ']))
      .toEqual(['Study', 'Be Grateful', 'Health', 'Calm', 'Growth', 'Joy']); // in-use first, then presets (per the interface line; the plan's original expectation omitted them, contradicting its own test 2 below)
  });

  it('appends presets the user has not used yet, skipping already-used ones', () => {
    expect(intentionSuggestions(['health'])).toEqual(['health', 'Calm', 'Growth', 'Joy']);
    expect(intentionSuggestions([])).toEqual(['Health', 'Calm', 'Growth', 'Joy']);
  });
});
