const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(key: string): boolean {
  if (!KEY_RE.test(key)) return false;
  const d = fromKey(key);
  return !Number.isNaN(d.getTime()) && toKey(d) === key;
}

/** Local-time ISO-day key. Never uses Date#toISOString, which shifts to UTC. */
export function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight; 'YYYY-MM-DD' string parsing would be UTC
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n); // calendar-day arithmetic: DST-safe, unlike += n * 86_400_000
  return toKey(d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function weekdayIndex(key: string): number {
  return fromKey(key).getDay(); // 0 = Sunday … 6 = Saturday
}

export function dayOfYear(key: string): number {
  const d = fromKey(key);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round((d.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Exactly 7 columns: 5 previous days, today, 1 disabled future preview. */
export function stripDays(anchor: string = todayKey()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(anchor, i - 5));
}

export function formatLong(key: string): string {
  return fromKey(key).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function formatShort(key: string): string {
  return fromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatWeekday(key: string): string {
  return fromKey(key).toLocaleDateString('en-US', { weekday: 'short' });
}

export function classifyDate(key: string, today: string = todayKey()): 'past' | 'today' | 'future' {
  if (key === today) return 'today';
  return key < today ? 'past' : 'future';
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function yearDays(year: number): string[] {
  const length = isLeapYear(year) ? 366 : 365;
  return Array.from({ length }, (_, i) => toKey(new Date(year, 0, 1 + i)));
}

/** Monday-based weekday position: Monday = 0 … Sunday = 6. */
function mondayIndex(key: string): number {
  return (weekdayIndex(key) + 6) % 7;
}

/** First day of the GitHub grid: the Monday on or before Jan 1. */
export function gridStart(year: number): string {
  return addDays(`${year}-01-01`, -mondayIndex(`${year}-01-01`));
}

/** 0-based week column containing the given date. */
export function weekColumn(key: string, year: number): number {
  const start = gridStart(year);
  // round, not floor: DST shifts the millisecond delta off exact day multiples
  const days = Math.round((fromKey(key).getTime() - fromKey(start).getTime()) / 86_400_000);
  return Math.floor(days / 7);
}

export function monthLabelPositions(year: number): Array<{ month: number; column: number }> {
  return Array.from({ length: 12 }, (_, month) => ({
    month,
    column: weekColumn(toKey(new Date(year, month, 1)), year),
  }));
}
