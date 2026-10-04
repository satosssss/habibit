import { describe, expect, it } from 'vitest';
import { generateCoachInsights } from './coach';
import { addDays } from './dates';
import type { Entry, Habit } from './types';

// Coach spec R1/R2: the engine takes `today` as a parameter, so every fixture
// pins an explicit date. 2026-10-04 is a Sunday; the trailing-14 window is
// Mon 2026-09-21 … Sun 2026-10-04 (14 scheduled slots for a daily habit).
const TODAY = '2026-10-04';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Meditate', icon: 'flower2', color: '#c026d3', category: 'Morning',
  intention: 'Study', type: 'boolean', target: 1, unit: '',
  frequency: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: 0, ...over,
});

const createdDaysAgo = (n: number) => Date.parse(`${addDays(TODAY, -n)}T00:00:00`);

const entry = (habitId: string, date: string, value = 1, hour = 12): Entry => ({
  id: `${habitId}_${date}`, habitId, date, value,
  timestamp: Date.parse(`${date}T${String(hour).padStart(2, '0')}:15:00`),
});

describe('coach: struggle detection (spec R1 I2/I3)', () => {
  it('returns nothing when there are no habits', () => {
    expect(generateCoachInsights([], [], TODAY)).toEqual([]);
  });

  it('stays silent while a habit has fewer than 6 scheduled slots', () => {
    const young = habit({ createdAt: createdDaysAgo(4) });   // Sep 30 … Oct 4 = 5 slots
    expect(generateCoachInsights([young], [], TODAY)).toEqual([]);
  });

  it('fires struggle when the 14-day rate is under 50% with ≥6 slots', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });      // exactly 14 slots
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d));
    const freq = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'frequency');
    expect(freq).toBeDefined();
    expect(freq!.kind).toBe('struggle');
    expect(freq!.id).toBe('struggle:h1');
    expect(freq!.body).toContain('6 of 14 scheduled days');
  });

  it('fires struggle for a never-completed habit once it has 6 slots (0/6)', () => {
    const h = habit({ createdAt: createdDaysAgo(5) });       // Sep 29 … Oct 4 = 6 slots
    const freq = generateCoachInsights([h], [], TODAY).find((i) => i.category === 'frequency');
    expect(freq?.body).toContain('0 of 6 scheduled days');
  });

  it('does not flag a habit sitting at exactly 50%', () => {
    const h = habit({ createdAt: createdDaysAgo(7) });       // 8 slots
    const entries = ['2026-09-27', '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => entry(h.id, d));
    expect(generateCoachInsights([h], entries, TODAY).filter((i) => i.kind === 'struggle')).toEqual([]);
  });

  it('missed-3 also needs the 6-slot floor', () => {
    const h = habit({ createdAt: createdDaysAgo(4) });       // 5 slots, all missed
    expect(generateCoachInsights([h], [], TODAY)).toEqual([]);
  });

  it('fires struggle on 3 consecutive missed scheduled days despite a good window rate', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    // Done through Sep 30, Oct 1–3 missed → 10/14 = 71%, which the rate path
    // would never flag: only the missed-run path can produce this insight.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
                     '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30']
      .map((d) => entry(h.id, d));
    const out = generateCoachInsights([h], entries, TODAY);
    expect(out.some((i) => i.kind === 'struggle' && i.category === 'frequency')).toBe(true);
  });

  it('treats an unfinished today as pending, not missed (grace, stats.ts precedent)', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    // Done through Oct 1; Oct 2–3 missed; today pending. The real run is only
    // two misses — counting today as a third would wrongly fire.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25',
                     '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01'].map((d) => entry(h.id, d));
    expect(generateCoachInsights([h], entries, TODAY).filter((i) => i.kind === 'struggle')).toEqual([]);
  });
});

describe('coach: frequency suggestions (spec R2.1)', () => {
  it('cuts the two worst weekdays, ties dropping the later weekday first', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    // Done Mon–Wed both weeks only → 6/14 = 43%; Thu–Sun all zero-hit.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d));
    const freq = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'frequency')!;
    // Zero-hit tie {Thu, Fri, Sat, Sun} → later weekday first: Sat(6), Fri(5).
    expect(freq.patch?.frequency).toEqual([0, 1, 2, 3, 4]);
    expect(freq.body).toContain('Trim Saturday and Friday?');
  });

  it('ranks a fully-missed weekday above midweek ties', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    // First week Mon–Sat done, both Sundays missed → Sun the only zero-hit
    // day; the six one-hit weekdays tie → Sat is the second cut.
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-24', '2026-09-25', '2026-09-26'].map((d) => entry(h.id, d));
    const freq = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'frequency')!;
    expect(freq.patch?.frequency).toEqual([1, 2, 3, 4, 5]);
    expect(freq.body).toContain('Trim Sunday and Saturday?');
  });

  it('never cuts below three days a week (no frequency insight at 3×)', () => {
    const h = habit({ createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });
    const out = generateCoachInsights([h], [], TODAY);
    expect(out.some((i) => i.category === 'frequency')).toBe(false);
  });

  it('cuts a single day at 4×/week with the one-day copy', () => {
    const h = habit({ createdAt: createdDaysAgo(14), frequency: [1, 2, 3, 5] });
    const freq = generateCoachInsights([h], [], TODAY).find((i) => i.category === 'frequency')!;
    expect(freq.patch?.frequency).toEqual([1, 2, 3]);
    expect(freq.body).toContain('Trim Friday?');
    expect(freq.body).not.toContain(' and ');
  });
});

describe('coach: reminder suggestions (spec R2.2)', () => {
  it('derives the reminder from the peak hour minus 30 minutes', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 20));
    const remind = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reminder')!;
    expect(remind.title).toBe('Pick a reminder time');
    expect(remind.body).toBe('Meditate has no reminder. You usually check off habits around 8 pm — set 7:30 pm?');
    expect(remind.patch?.reminderTime).toBe('19:30');
    expect(remind.id).toBe('struggle:h1');
  });

  it('wraps midnight: a 00:00 peak suggests 23:30', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 0));
    const remind = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reminder')!;
    expect(remind.patch?.reminderTime).toBe('23:30');
    expect(remind.body).toContain('around 12 am — set 11:30 pm?');
  });

  it('stays silent when the derived time equals the current reminder', () => {
    const h = habit({ createdAt: createdDaysAgo(13), reminderTime: '19:30' });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 20));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'reminder')).toBe(false);
  });

  it('invents nothing with no completions in the trailing 30 days', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    expect(generateCoachInsights([h], [], TODAY).some((i) => i.category === 'reminder')).toBe(false);
  });

  it('uses the "move" copy variant when a reminder already exists', () => {
    const h = habit({ createdAt: createdDaysAgo(13), reminderTime: '09:00' });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(h.id, d, 1, 20));
    const remind = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reminder')!;
    expect(remind.title).toBe('Move your reminder');
    expect(remind.body).toContain('Meditate reminds you at 9:00 am');
    expect(remind.patch?.reminderTime).toBe('19:30');
  });

  it('resolves a mode-hour tie to the earliest hour (across all habits)', () => {
    const a = habit({ id: 'a1', name: 'Slippery', createdAt: createdDaysAgo(13) });
    const b = habit({ id: 'b1', name: 'Morning Pages', createdAt: createdDaysAgo(13) });
    const entries = [
      ...['2026-09-21', '2026-09-22', '2026-09-23'].map((d) => entry(a.id, d, 1, 20)),
      ...['2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry(b.id, d, 1, 8)),
    ];
    const remind = generateCoachInsights([a, b], entries, TODAY).find(
      (i) => i.category === 'reminder' && i.habitId === 'a1',
    )!;
    expect(remind.patch?.reminderTime).toBe('07:30');   // 8 − 30min wins the 3-vs-3 tie
  });
});

describe('coach: habit stacking (spec R2.3)', () => {
  it('stacks against the steadiest habit sharing a scheduled day', () => {
    const a = habit({ id: 'a1', name: 'Slippery', createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });
    const b = habit({ id: 'b1', name: 'Meditate', createdAt: createdDaysAgo(13) });
    const c = habit({ id: 'c1', name: 'Couch Time', createdAt: createdDaysAgo(13) });
    const entries = [
      ...Array.from({ length: 14 }, (_, i) => entry(b.id, addDays('2026-09-21', i))),
      ...['2026-09-21', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']
        .map((d) => entry(c.id, d)),
    ];
    const stack = generateCoachInsights([a, b, c], entries, TODAY).find((i) => i.category === 'stack')!;
    expect(stack.body).toBe('Stack it: do Slippery right after Meditate — your steadiest habit.');
    expect(stack.patch).toBeUndefined();                 // text-only (spec Q2)
    expect(stack.id).toBe('struggle:a1');
  });

  it('needs a shared scheduled weekday', () => {
    const a = habit({ id: 'a1', createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });  // Tue/Thu/Sat
    const c = habit({ id: 'c1', createdAt: createdDaysAgo(13), frequency: [0, 2, 4] });  // Sun/Wed/Fri
    const out = generateCoachInsights([a, c], [], TODAY);
    expect(out.some((i) => i.category === 'stack')).toBe(false);
  });

  it('gives up with only one habit', () => {
    const a = habit({ createdAt: createdDaysAgo(13) });
    expect(generateCoachInsights([a], [], TODAY).some((i) => i.category === 'stack')).toBe(false);
  });

  it('breaks an anchor tie by streak, then alphabetically', () => {
    const a = habit({ id: 'a1', name: 'Slippery', createdAt: createdDaysAgo(13), frequency: [1, 3, 5] });
    const b = habit({ id: 'b1', name: 'Alpha', createdAt: createdDaysAgo(13) });          // rate 5/14, streak 0
    const d = habit({ id: 'd1', name: 'Zen', createdAt: createdDaysAgo(13) });            // rate 5/14, streak 5
    const entries = [
      ...['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].map((x) => entry(b.id, x)),
      ...['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((x) => entry(d.id, x)),
    ];
    const stack = generateCoachInsights([a, b, d], entries, TODAY).find(
      (i) => i.category === 'stack' && i.habitId === 'a1',
    )!;
    expect(stack.body).toContain('after Zen');           // equal rate → higher streak beats the A…Z tiebreak
  });
});
