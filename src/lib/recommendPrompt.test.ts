import { describe, expect, it } from 'vitest';
import { emptyProfile, mergeProfile } from './profile';
import { buildRecommendationPrompt, type PromptHistory } from './recommendPrompt';

const history: PromptHistory = {
  activeDays: 6,
  completions: 11,
  ratePct: 65,
  habitNames: ['Meditate', 'Walk'],
};

const profile = mergeProfile(emptyProfile(0), {
  accountEmail: 'secret@example.com',
  lifestyle: {
    wakeTime: '06:30', sleepTime: '22:30', schedule: 'Office 9–5',
    activityLevel: 'low', currentHabits: 'coffee', timeSinks: 'phone at night',
  },
  goals: { items: ['Sleep better', 'Move daily'], timeframe: '3 months', why: 'More energy' },
  challenges: 'All-or-nothing thinking',
  preferences: { reminderTime: '08:00', tone: 'direct' },
}, 1);

describe('buildRecommendationPrompt (spec R5)', () => {
  it('includes the answers and the history counts', () => {
    const { system, user } = buildRecommendationPrompt({ profile, history });
    expect(user).toContain('Sleep better; Move daily');
    expect(user).toContain('3 months');
    expect(user).toContain('06:30');
    expect(user).toContain('Office 9–5');
    expect(user).toContain('All-or-nothing thinking');
    expect(user).toContain('Active days: 6');
    expect(user).toContain('Completions: 11');
    expect(user).toContain('Completion rate: 65%');
    expect(user).toContain('Meditate, Walk');
    expect(system).toContain('Blunt and practical');
  });

  it('never leaks email, Google name or avatar', () => {
    const { system, user } = buildRecommendationPrompt({ profile, history });
    const whole = `${system}\n${user}`;
    expect(whole).not.toContain('secret@example.com');
    expect(whole).not.toContain('accountEmail');
    expect(whole.toLowerCase()).not.toContain('avatar');
  });

  it('adds a JSON skeleton only for the on-device path', () => {
    const schema = buildRecommendationPrompt({ profile, history });
    const json = buildRecommendationPrompt({ profile, history, format: 'json' });
    expect(json.system).toContain('{"suggestions"');
    expect(schema.system).not.toContain('{"suggestions"');
    expect(schema.system).toContain('Reply with JSON only.');
  });

  it('says "none given" instead of inventing data', () => {
    const blank = emptyProfile(0);
    const { user } = buildRecommendationPrompt({ profile: blank, history });
    expect(user).toContain('Goals: none given');
    expect(user).toContain('Work or school schedule: not given');
  });
});
