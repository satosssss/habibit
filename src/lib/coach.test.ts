import { beforeEach, describe, expect, it } from 'vitest';
import { dismissSuggestion, generateCoachInsights, liveDismissals, visibleInsights } from './coach';
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

describe('coach: level-up (spec R2.4–2.5)', () => {
  it('an easy habit with streak 7 suggests medium', () => {
    const h = habit({ createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const entries = ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => entry(h.id, d));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'difficulty')!;
    expect(level.patch?.difficulty).toBe('medium');
    expect(level.body).toBe('7-day streak on Meditate. Ready for Medium?');
    expect(level.id).toBe('levelup:h1:difficulty');
  });

  it('medium needs streak 14 before suggesting hard', () => {
    const h = habit({ createdAt: createdDaysAgo(20), difficulty: 'medium' });
    const entries = ['2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29',
                     '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map((d) => entry(h.id, d));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'difficulty')).toBe(false);
  });

  it('medium with streak 14 suggests hard', () => {
    const h = habit({ createdAt: createdDaysAgo(20), difficulty: 'medium' });
    const entries = Array.from({ length: 14 }, (_, i) => entry(h.id, addDays('2026-09-20', i)));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'difficulty')!;
    expect(level.patch?.difficulty).toBe('hard');
    expect(level.body).toBe('14-day streak on Meditate. Ready for Hard?');
  });

  it('legacy habits (no difficulty stored) read as medium', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 14 }, (_, i) => entry(h.id, addDays('2026-09-20', i)));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'difficulty')!;
    expect(level.patch?.difficulty).toBe('hard');          // undefined → medium → hard (streak 14 ✓)
  });

  it('legacy habits below streak 14 suggest nothing', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 8 }, (_, i) => entry(h.id, addDays('2026-09-26', i)));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'difficulty')).toBe(false);
  });

  it('hard is terminal', () => {
    const h = habit({ createdAt: createdDaysAgo(40), difficulty: 'hard' });
    const entries = Array.from({ length: 30 }, (_, i) => entry(h.id, addDays('2026-09-04', i)));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'difficulty')).toBe(false);
  });

  it('quantity targets bump by 10%', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'quantity', target: 10000, unit: 'steps' });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 10000));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'target')!;
    expect(level.patch?.target).toBe(11000);
    expect(level.body).toBe('10,000 steps for 7 days straight. Try 11,000?');
    expect(level.id).toBe('levelup:h1:target');
  });

  it('drops an empty unit from the quantity copy', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'quantity', target: 10000, unit: '' });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 10000));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'target')!;
    expect(level.body).toBe('10,000 for 7 days straight. Try 11,000?');
  });

  it('timer targets bump to the next whole minute of +10%', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'timer', target: 900 });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 900));
    const level = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'target')!;
    expect(level.patch?.target).toBe(1020);
    expect(level.body).toBe('7-day streak at 15 minutes. Try 17?');
  });

  it('stays quiet when a timer bump would round to the current value', () => {
    const h = habit({ createdAt: createdDaysAgo(20), type: 'timer', target: 90 });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i), 90));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'target')).toBe(false);
  });
});

describe('coach: rewards (spec R2.6–2.8)', () => {
  it('fires a streak milestone at exactly 7', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 7 }, (_, i) => entry(h.id, addDays('2026-09-27', i)));
    const ms = generateCoachInsights([h], entries, TODAY).find((i) => i.category === 'reward-streak')!;
    expect(ms.id).toBe(`reward:h1:streak:7`);
    expect(ms.body).toBe(`7 days of Meditate in a row. That's a habit now.`);
  });

  it('stays silent at streak 8 (milestones fire exactly)', () => {
    const h = habit({ createdAt: createdDaysAgo(20) });
    const entries = Array.from({ length: 8 }, (_, i) => entry(h.id, addDays('2026-09-26', i)));
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'reward-streak')).toBe(false);
  });

  it('fires a perfect day when every scheduled habit is done today', () => {
    const a = habit({ id: 'a1', name: 'Meditate', createdAt: createdDaysAgo(13) });
    const b = habit({ id: 'b1', name: 'Read', createdAt: createdDaysAgo(13) });
    const entries = [entry('a1', TODAY), entry('b1', TODAY)];
    const out = generateCoachInsights([a, b], entries, TODAY);
    expect(out.find((i) => i.category === 'reward-day')).toMatchObject({
      id: `reward:perfectday:${TODAY}`,
      body: 'Every habit checked off today. Perfect day.',
    });
  });

  it('stays silent while one habit is still open', () => {
    const a = habit({ id: 'a1', createdAt: createdDaysAgo(13) });
    const b = habit({ id: 'b1', createdAt: createdDaysAgo(13) });
    const entries = [entry('a1', TODAY)];
    expect(generateCoachInsights([a, b], entries, TODAY).some((i) => i.category === 'reward-day')).toBe(false);
  });

  it('stays silent when nothing is scheduled today', () => {
    const h = habit({ createdAt: createdDaysAgo(13), frequency: [1] });   // Mondays only
    const entries = [entry('h1', TODAY)];
    expect(generateCoachInsights([h], entries, TODAY).some((i) => i.category === 'reward-day')).toBe(false);
  });

  it('encourages at two more completions than last week', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',          // last week: 3
                     '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01', '2026-10-02'].map((d) => entry(h.id, d));   // this week: 5
    const out = generateCoachInsights([h], entries, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'encourage:2026-09-28',
      body: 'You logged 2 more completions than last week. Keep that going.',
    });
  });

  it('stays silent at only one more completion than last week', () => {
    const h = habit({ createdAt: createdDaysAgo(13) });
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',          // last week: 3
                     '2026-09-28', '2026-09-29', '2026-09-30',
                     '2026-10-01'].map((d) => entry(h.id, d));          // this week: 4
    expect(generateCoachInsights([h], entries, TODAY)).toEqual([]);
  });
});

describe('coach: ranking + determinism (spec R1 I1/I4)', () => {
  it('orders struggle → level-up → reward → encouragement', () => {
    // s1: 0/14 struggling; reminder pre-set so the global peak (12:00 from
    // l1's entries) equals it and stays silent — ids stay predictable.
    const s = habit({ id: 's1', name: 'Slippery', createdAt: createdDaysAgo(13), reminderTime: '11:30' });
    const l = habit({ id: 'l1', name: 'Lifter', createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('l1', addDays('2026-09-27', i)));
    const ids = generateCoachInsights([s, l], entries, TODAY).map((i) => i.id);
    expect(ids).toEqual([
      'struggle:s1',             // frequency (rate 0, first category)
      'struggle:s1',             // stack against l1 (≥7 slots, shared days)
      'levelup:l1:difficulty',   // rank 1
      'reward:l1:streak:7',      // rank 2
      'encourage:2026-09-28',    // rank 3
    ]);
  });

  it('orders struggling habits worst-rate first', () => {
    const a = habit({ id: 'a1', name: 'Never', createdAt: createdDaysAgo(13) });       // 0%
    const b = habit({ id: 'b1', name: 'Sometimes', createdAt: createdDaysAgo(13) });   // 6/14 = 43%
    const entries = ['2026-09-21', '2026-09-22', '2026-09-23',
                     '2026-09-28', '2026-09-29', '2026-09-30'].map((d) => entry('b1', d));
    // Input order deliberately reversed — only the rate sort can fix it.
    const freqOrder = generateCoachInsights([b, a], entries, TODAY)
      .filter((i) => i.category === 'frequency').map((i) => i.habitId);
    expect(freqOrder).toEqual(['a1', 'b1']);
  });

  it('within a rank, categories follow catalog order (difficulty before target)', () => {
    const e = habit({ id: 'e1', name: 'Stretch', createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const q = habit({ id: 'q1', name: 'Steps', createdAt: createdDaysAgo(20),
                      type: 'quantity', target: 1000, unit: 'steps' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('e1', addDays('2026-09-27', i), 1))
      .concat(Array.from({ length: 7 }, (_, i) => entry('q1', addDays('2026-09-27', i), 1000)));
    const ids = generateCoachInsights([q, e], entries, TODAY).map((i) => i.id);   // input reversed
    expect(ids.indexOf('levelup:e1:difficulty')).toBeLessThan(ids.indexOf('levelup:q1:target'));
  });

  it('same inputs return deep-equal output (I1)', () => {
    const s = habit({ id: 's1', name: 'Slippery', createdAt: createdDaysAgo(13), reminderTime: '11:30' });
    const l = habit({ id: 'l1', name: 'Lifter', createdAt: createdDaysAgo(20), difficulty: 'easy' });
    const entries = Array.from({ length: 7 }, (_, i) => entry('l1', addDays('2026-09-27', i)));
    const run = () => generateCoachInsights([s, l], entries, TODAY);
    expect(run()).toEqual(run());
  });
});

describe('coach: dismissal storage (7-day TTL, spec §4)', () => {
  beforeEach(() => localStorage.clear());

  it('treats corrupt storage as empty', () => {
    localStorage.setItem('habibit:coach-dismissals', '{not json');
    expect(liveDismissals()).toEqual({});
  });

  it('dismissSuggestion records the id with a timestamp', () => {
    const now = Date.now();
    dismissSuggestion('struggle:h1', now);
    expect(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!))
      .toEqual({ 'struggle:h1': now });
  });

  it('prunes expired dismissals on write', () => {
    const now = Date.now();
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({
      old: now - 8 * 86_400_000, fresh: now - 86_400_000,
    }));
    dismissSuggestion('new:id', now);
    expect(JSON.parse(localStorage.getItem('habibit:coach-dismissals')!))
      .toEqual({ fresh: now - 86_400_000, 'new:id': now });
  });

  it('liveDismissals drops expired entries', () => {
    const now = Date.now();
    localStorage.setItem('habibit:coach-dismissals', JSON.stringify({
      old: now - 8 * 86_400_000, fresh: now - 86_400_000,
    }));
    expect(liveDismissals(now)).toEqual({ fresh: now - 86_400_000 });
  });

  it('visibleInsights hides fresh dismissals and brings expired ones back', () => {
    const now = Date.now();
    const insights = ['a', 'b'].map((id) => ({
      id, kind: 'struggle' as const, category: 'frequency' as const,
      habitId: id, title: 't', body: 'b',
    }));
    expect(visibleInsights(insights, { a: now - 1000, b: now - 8 * 86_400_000 }, now).map((i) => i.id))
      .toEqual(['b']);
  });
});
