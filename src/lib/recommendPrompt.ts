import type { Profile } from './types';

/**
 * The only profile fields that ever reach a model. The server route receives
 * exactly this shape, so email, Google name and avatar cannot be sent by
 * accident (spec R5).
 */
export type ProfileAnswers = Pick<Profile, 'lifestyle' | 'goals' | 'challenges' | 'preferences'>;

/** Everything the model is allowed to see: answers + a 14-day count summary. */
export interface PromptHistory {
  activeDays: number;
  completions: number;
  ratePct: number;
  habitNames: string[];
}

export interface PromptInput {
  profile: ProfileAnswers;
  history: PromptHistory;
  /** `json` adds an explicit skeleton for the Prompt API, which has no schema. */
  format?: 'schema' | 'json';
}

const TONE: Record<Profile['preferences']['tone'], string> = {
  gentle: 'Warm and encouraging. Never scold. One small win at a time.',
  direct: 'Blunt and practical. Short sentences. No cheerleading.',
};

/**
 * Profile spec R5: the single prompt used by the server route and the device
 * model. It reads only the answer surface plus counts — never `accountEmail`,
 * the Google name, the avatar, or entry timestamps.
 */
export function buildRecommendationPrompt({ profile, history, format = 'schema' }: PromptInput): {
  system: string; user: string;
} {
  const { lifestyle, goals, challenges, preferences } = profile;
  const goalList = goals.items.filter(Boolean);

  const system = [
    'You suggest habits for a local-first habit tracker.',
    TONE[preferences.tone],
    'Suggest 3 to 5 habits that fit the person\'s real day and address what has',
    'made habits fail before. Every habit must start small enough to do today.',
    'Do not repeat a habit they already track. Do not give medical advice.',
    format === 'json'
      ? 'Reply with JSON only, exactly: {"suggestions":[{"name":"","reason":"","suggestedTime":"HH:MM","firstStep":""}]}'
      : 'Reply with JSON only.',
  ].join(' ');

  const lines = [
    `Goals: ${goalList.length ? goalList.join('; ') : 'none given'}`,
    `Timeframe: ${goals.timeframe || 'unspecified'}`,
    `Why these matter: ${goals.why || 'not given'}`,
    `Wake: ${lifestyle.wakeTime}  Sleep: ${lifestyle.sleepTime}`,
    `Work or school schedule: ${lifestyle.schedule || 'not given'}`,
    `Activity level: ${lifestyle.activityLevel}`,
    `Current habits: ${lifestyle.currentHabits || 'none given'}`,
    `Biggest time sinks: ${lifestyle.timeSinks || 'not given'}`,
    `What made habits hard before: ${challenges || 'not given'}`,
    `Preferred reminder time: ${preferences.reminderTime || 'any'}`,
    '',
    'Last 14 days:',
    `- Active days: ${history.activeDays}`,
    `- Completions: ${history.completions}`,
    `- Completion rate: ${history.ratePct}%`,
    `- Habits already tracked: ${history.habitNames.length ? history.habitNames.join(', ') : 'none'}`,
    '',
    'For each suggestion give: name (short), reason (why it fits this person),',
    'suggestedTime (24h HH:MM), firstStep (under 10 minutes).',
  ];

  return { system, user: lines.join('\n') };
}

/** Extra line the device model needs; kept out of the server prompt. */
export const DEVICE_APPEND = '\nReturn one JSON object and nothing else.';
