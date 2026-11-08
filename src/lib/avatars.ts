/**
 * Onboarding v2: a small, deliberately finite set of avatars. Emoji keeps the
 * picker colourful without shipping image assets, and a fixed list means the
 * profile only ever stores an id — no user-supplied HTML, no photo upload.
 */
export interface Avatar {
  id: string;
  emoji: string;
  label: string;
}

export const AVATARS: readonly Avatar[] = [
  { id: 'spark', emoji: '✨', label: 'Spark' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'sprout', emoji: '🌱', label: 'Sprout' },
  { id: 'moon', emoji: '🌙', label: 'Moon' },
  { id: 'sun', emoji: '☀️', label: 'Sun' },
  { id: 'wave', emoji: '🌊', label: 'Wave' },
  { id: 'cat', emoji: '🐈', label: 'Cat' },
  { id: 'owl', emoji: '🦉', label: 'Owl' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'cactus', emoji: '🌵', label: 'Cactus' },
  { id: 'mountain', emoji: '⛰️', label: 'Mountain' },
  { id: 'star', emoji: '⭐', label: 'Star' },
] as const;

export const DEFAULT_AVATAR_ID = 'spark';

export function isAvatarId(value: unknown): value is string {
  return typeof value === 'string' && AVATARS.some((avatar) => avatar.id === value);
}

/** Never throws: an unknown id (old export, hand-edited row) falls back. */
export function avatarFor(id: string | null | undefined): Avatar {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0];
}
