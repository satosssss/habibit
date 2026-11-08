'use client';

import { ArrowLeft, ArrowRight, Check, PartyPopper, Sparkles } from 'lucide-react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AVATARS, avatarFor } from '@/lib/avatars';
import { todayKey } from '@/lib/dates';
import {
  ACTIVITY_LEVELS, CHALLENGE_SUGGESTIONS, TIMEFRAMES, TONES, emptyProfile, normalizeGoals,
} from '@/lib/profile';
import { getProfile, putEntry, putHabits, saveProfile } from '@/lib/repo';
import { GOAL_OPTIONS, MAX_STARTERS, starterFor, starterToHabit, type StarterHabit } from '@/lib/starterHabits';
import type { Habit, Profile } from '@/lib/types';

const STEPS = ['You', 'Your day', 'Goals', 'Obstacles', 'First habits'] as const;

const inputClass = 'glass-input';
const labelClass = 'mb-1 block text-sm font-semibold';
const textareaClass = 'glass-input min-h-20 resize-y';

/**
 * Onboarding v2 (replaces the four-question form).
 *
 * Shape: five questions, then a first win. The research on this category is
 * consistent — the screens are not the product, the first completed habit is —
 * so the flow ends by creating the picked habits and offering to tick the first
 * one immediately. All answers still land as a single Dexie row on save, so
 * Back/Next never half-write, and the same screen still edits an existing
 * profile (pre-filled, never re-creating habits).
 */
export function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(() => emptyProfile());
  const [existing, setExisting] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customGoal, setCustomGoal] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [created, setCreated] = useState<Habit[] | null>(null);
  const [firstDone, setFirstDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      getProfile().catch(() => null),
      getSession().catch(() => null),
    ]).then(([profile, session]) => {
      if (!alive) return;
      if (profile) {
        setDraft(profile);
        setExisting(true);
      }
      setEmail(session?.user?.email ?? null);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  const setIdentity = <K extends keyof Profile['identity']>(
    key: K, value: Profile['identity'][K],
  ) => setDraft((p) => ({ ...p, identity: { ...p.identity, [key]: value } }));

  const setLifestyle = <K extends keyof Profile['lifestyle']>(
    key: K, value: Profile['lifestyle'][K],
  ) => setDraft((p) => ({ ...p, lifestyle: { ...p.lifestyle, [key]: value } }));

  const setPreference = <K extends keyof Profile['preferences']>(
    key: K, value: Profile['preferences'][K],
  ) => setDraft((p) => ({ ...p, preferences: { ...p.preferences, [key]: value } }));

  const toggleGoal = (goal: string) => setDraft((p) => {
    const items = p.goals.items.filter(Boolean);
    const next = items.includes(goal)
      ? items.filter((item) => item !== goal)
      : items.length >= 3 ? items : [...items, goal];
    return { ...p, goals: { ...p.goals, items: next } };
  });

  const toggleChallenge = (chip: string) => setDraft((p) => {
    const parts = p.challenges.split('\n').map((line) => line.trim()).filter(Boolean);
    const next = parts.includes(chip) ? parts.filter((part) => part !== chip) : [...parts, chip];
    return { ...p, challenges: next.join('\n') };
  });

  const togglePick = (id: string) => setPicked((current) => {
    if (current.includes(id)) return current.filter((item) => item !== id);
    if (current.length >= MAX_STARTERS) return current;
    return [...current, id];
  });

  const chosenGoals = draft.goals.items.filter(Boolean);
  // Stable key so the picker only recomputes when the goal set actually changes.
  const goalKey = draft.goals.items.join('|');
  const options = useMemo(() => starterFor(goalKey.split('|').filter(Boolean)), [goalKey]);
  const pickedHabits = options.filter((habit) => picked.includes(habit.id));

  const finish = async (skip: boolean) => {
    setError(null);
    setSaving(true);
    const goals = normalizeGoals(Array.from(new Set([...draft.goals.items, customGoal])));
    try {
      await saveProfile({
        identity: draft.identity,
        lifestyle: draft.lifestyle,
        goals: { ...draft.goals, items: goals },
        challenges: draft.challenges.trim(),
        preferences: draft.preferences,
        skipped: skip,
        onboardedAt: existing ? draft.onboardedAt : Date.now(),
        // Ownership of the device is claimed once, on first save (spec D4).
        accountEmail: existing ? undefined : email,
      });

      if (!existing && pickedHabits.length > 0) {
        const habits = pickedHabits.map((starter, index) => starterToHabit(starter, index));
        await putHabits(habits);
        setCreated(habits);
        setStep(STEPS.length);
        setSaving(false);
        return;
      }
      router.replace('/home');
    } catch {
      setSaving(false);
      setError('Could not save the profile in this browser. Try again.');
    }
  };

  const completeFirst = async () => {
    const habit = created?.[0];
    if (!habit) return;
    setSaving(true);
    try {
      await putEntry(habit.id, todayKey(), 1);
      setFirstDone(true);
      setError(null);
    } catch {
      setError('Could not save that tick in this browser.');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return <p role="status" className="p-10 text-center text-sm text-[var(--color-subtle)]">Loading…</p>;
  }

  // Step 5 (index 5) is the reward screen, not a question.
  if (step === STEPS.length && created) {
    const starter: StarterHabit | undefined = pickedHabits[0];
    const avatar = avatarFor(draft.identity.avatarId);
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-12">
        <div className="glass-card mt-10 p-6 text-center">
          <span aria-hidden className="text-5xl">{avatar.emoji}</span>
          <h1 className="mt-3 text-2xl font-extrabold">
            {draft.identity.displayName ? `You're set, ${draft.identity.displayName}.` : "You're set."}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-subtle)]">
            {created.length === 1 ? 'One habit, ready to go.' : `${created.length} habits, ready to go.`} The
            first tick is the one that matters — everything after it is momentum.
          </p>

          <div className="mt-6 rounded-2xl border border-[var(--color-line)] p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">First win</p>
            <p className="mt-1 text-base font-semibold">{created[0].name}</p>
            {starter && <p className="mt-1 text-xs text-[var(--color-subtle)]">Start with: {starter.firstStep}</p>}
            <button type="button" disabled={saving || firstDone} onClick={() => void completeFirst()}
                    className={`mt-3 inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${
                      firstDone
                        ? 'border border-[var(--color-line)] text-[var(--color-subtle)]'
                        : 'btn-primary'
                    }`}>
              <Check size={15} aria-hidden /> {firstDone ? 'Done for today' : saving ? 'Saving…' : 'I did it'}
            </button>
          </div>

          {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}

          <button type="button" onClick={() => router.replace('/home')}
                  className="mt-6 inline-flex min-h-10 items-center gap-2 btn-glass px-4 py-2.5 text-sm font-semibold">
            <PartyPopper size={15} aria-hidden /> Open my day
          </button>
        </div>
      </main>
    );
  }

  const lastStep = step === STEPS.length - 1;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-12">
      <header className="py-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
          {existing ? 'Edit profile' : 'Welcome to Habibit'}
        </p>
        <h1 className="mt-1 text-xl font-extrabold">{STEPS[step]}</h1>
        <p className="mt-1 text-sm text-[var(--color-subtle)]">
          {existing
            ? 'Answers feed your habit ideas. Change anything, any time.'
            : 'Five quick questions, then your first habit — about 90 seconds.'}
        </p>
      </header>

      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
        <div role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length}
             aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${STEPS.length}`}
             className="h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
          <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] motion-safe:duration-300"
               style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <section className="glass-card p-4 sm:p-6">
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <label className="block">
              <span className={labelClass}>What should we call you?</span>
              <input id="onboarding-name" value={draft.identity.displayName} maxLength={40}
                     autoComplete="given-name"
                     onChange={(e) => setIdentity('displayName', e.target.value)}
                     placeholder="Your first name is enough"
                     className={inputClass} />
            </label>

            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>Pick a face</legend>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map((avatar) => {
                  const active = draft.identity.avatarId === avatar.id;
                  return (
                    <button key={avatar.id} type="button" aria-pressed={active}
                            aria-label={avatar.label} title={avatar.label}
                            onClick={() => setIdentity('avatarId', avatar.id)}
                            className={`grid aspect-square min-h-11 place-items-center rounded-2xl border text-xl transition motion-safe:duration-150 ${
                              active
                                ? 'border-[var(--color-accent)] bg-[var(--color-muted)] scale-105'
                                : 'border-[var(--color-line)]'
                            }`}>
                      <span aria-hidden>{avatar.emoji}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[var(--color-subtle)]">
                Cosmetic only. Never sent to the AI, never shown to anyone else.
              </p>
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelClass}>Wake time</span>
                <input id="onboarding-wake" type="time" value={draft.lifestyle.wakeTime}
                       onChange={(e) => setLifestyle('wakeTime', e.target.value)}
                       className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Sleep time</span>
                <input id="onboarding-sleep" type="time" value={draft.lifestyle.sleepTime}
                       onChange={(e) => setLifestyle('sleepTime', e.target.value)}
                       className={inputClass} />
              </label>
            </div>

            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>How active is your day already?</legend>
              <div className="flex gap-2">
                {ACTIVITY_LEVELS.map((level) => (
                  <button key={level} type="button" aria-pressed={draft.lifestyle.activityLevel === level}
                          onClick={() => setLifestyle('activityLevel', level)}
                          className={`min-h-10 flex-1 rounded-xl border px-3 py-2.5 text-sm capitalize ${
                            draft.lifestyle.activityLevel === level
                              ? 'border-[var(--color-accent)] bg-[var(--color-muted)]'
                              : 'border-[var(--color-line)]'
                          }`}>
                    {level}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block">
              <span className={labelClass}>Work or school shape <span className="font-normal text-[var(--color-subtle)]">(optional)</span></span>
              <input id="onboarding-schedule" value={draft.lifestyle.schedule}
                     onChange={(e) => setLifestyle('schedule', e.target.value)}
                     placeholder="e.g. Office 9–5, classes in the morning"
                     className={inputClass} />
            </label>

            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>Coach me like this</legend>
              <div className="flex flex-col gap-2">
                {TONES.map((tone) => (
                  <button key={tone} type="button" aria-pressed={draft.preferences.tone === tone}
                          onClick={() => setPreference('tone', tone)}
                          className={`min-h-12 rounded-xl border px-4 py-3 text-left ${
                            draft.preferences.tone === tone
                              ? 'border-[var(--color-accent)] bg-[var(--color-muted)]'
                              : 'border-[var(--color-line)]'
                          }`}>
                    <span className="block text-sm font-semibold capitalize">{tone}</span>
                    <span className="block text-xs text-[var(--color-subtle)]">
                      {tone === 'gentle'
                        ? 'Warm, encouraging, never scolding.'
                        : 'Short, blunt, no cheerleading.'}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>What are you after? Pick up to three</legend>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((goal) => {
                  const active = chosenGoals.includes(goal);
                  return (
                    <button key={goal} type="button" aria-pressed={active} onClick={() => toggleGoal(goal)}
                            className={`min-h-10 rounded-full border px-3.5 py-2 text-sm ${
                              active
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                                : 'border-[var(--color-line)]'
                            }`}>
                      {goal}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[var(--color-subtle)]">Pick one if you are unsure. Focus beats ambition.</p>
            </fieldset>

            <label className="block">
              <span className={labelClass}>Something else?</span>
              <input value={customGoal} maxLength={60}
                     onChange={(e) => setCustomGoal(e.target.value)}
                     placeholder="e.g. practise guitar"
                     className={inputClass} />
            </label>

            <label className="block">
              <span className={labelClass}>Why does this matter? <span className="font-normal text-[var(--color-subtle)]">(optional)</span></span>
              <textarea id="onboarding-why" value={draft.goals.why}
                        onChange={(e) => setDraft((p) => ({ ...p, goals: { ...p.goals, why: e.target.value } }))}
                        placeholder="One honest sentence is enough."
                        className={textareaClass} />
            </label>

            <label className="block">
              <span className={labelClass}>Timeframe</span>
              <select value={draft.goals.timeframe}
                      onChange={(e) => setDraft((p) => ({ ...p, goals: { ...p.goals, timeframe: e.target.value } }))}
                      className={inputClass}>
                {TIMEFRAMES.map((frame) => <option key={frame} value={frame}>{frame}</option>)}
              </select>
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className={labelClass}>What has made habits hard to keep?</span>
              <textarea id="onboarding-challenges" value={draft.challenges}
                        onChange={(e) => setDraft((p) => ({ ...p, challenges: e.target.value }))}
                        placeholder="Past attempts, what got in the way, when you gave up…"
                        className={`${textareaClass} min-h-24`} />
            </label>
            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>Quick picks</legend>
              <div className="flex flex-wrap gap-2">
                {CHALLENGE_SUGGESTIONS.map((chip) => {
                  const active = draft.challenges.split('\n').map((line) => line.trim()).includes(chip);
                  return (
                    <button key={chip} type="button" aria-pressed={active}
                            onClick={() => toggleChallenge(chip)}
                            className={`min-h-10 rounded-full border px-3.5 py-2 text-sm ${
                              active
                                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent)]'
                                : 'border-[var(--color-line)]'
                            }`}>
                      {chip}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="block">
              <span className={labelClass}>Where does your time go? <span className="font-normal text-[var(--color-subtle)]">(optional)</span></span>
              <textarea id="onboarding-sinks" value={draft.lifestyle.timeSinks}
                        onChange={(e) => setLifestyle('timeSinks', e.target.value)}
                        placeholder="e.g. phone in the evening, long commute"
                        className={textareaClass} />
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            {existing ? (
              <p className="text-sm text-[var(--color-subtle)]">
                You already have habits on this device. Add or edit them from{' '}
                <Link href="/habits" className="font-semibold text-[var(--color-accent-ink)] underline underline-offset-4">Habits</Link>.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  Pick <strong>one to three</strong> to start with. Each one comes with the first step, so you never
                  have to decide what starting even means.
                </p>
                {chosenGoals.length > 0 && (
                  <p className="text-xs text-[var(--color-subtle)]">Chosen for: {chosenGoals.join(' · ')}</p>
                )}
                <ul className="flex flex-col gap-2">
                  {options.map((habit) => {
                    const active = picked.includes(habit.id);
                    return (
                      <li key={habit.id}>
                        <button type="button" aria-pressed={active} onClick={() => togglePick(habit.id)}
                                className={`w-full rounded-2xl border p-3 text-left transition motion-safe:duration-150 ${
                                  active
                                    ? 'border-[var(--color-accent)] bg-[var(--color-muted)]'
                                    : 'border-[var(--color-line)]'
                                }`}>
                          <span className="flex items-center gap-2">
                            <span aria-hidden className="text-lg">{habit.emoji}</span>
                            <span className="text-sm font-semibold">{habit.name}</span>
                            {active && <Check size={15} aria-hidden className="ml-auto text-[var(--color-accent-ink)]" />}
                          </span>
                          <span className="mt-1 block text-xs text-[var(--color-subtle)]">{habit.why}</span>
                          <span className="mt-1 block text-xs text-[var(--color-subtle)]">First step: {habit.firstStep}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-xs text-[var(--color-subtle)]">
                  {picked.length}/{MAX_STARTERS} selected{picked.length === 0 ? ' — or skip and add your own later.' : '.'}
                </p>
              </>
            )}

            <p className="flex items-start gap-2 text-xs text-[var(--color-subtle)]">
              <Sparkles size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Your answers stay on this device. Habit ideas send only your goals, routine and completion counts —
                never your name, email or photo.
              </span>
            </p>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {step > 0 && (
            <button type="button" onClick={() => { setError(null); setStep(step - 1); }}
                    className="flex min-h-10 items-center gap-1.5 btn-glass px-4 py-2.5 text-sm font-semibold">
              <ArrowLeft size={15} aria-hidden /> Back
            </button>
          )}

          {lastStep ? (
            <button type="button" disabled={saving} onClick={() => void finish(false)}
                    className="flex min-h-10 items-center gap-2 btn-primary px-4 py-2.5 text-sm">
              <Check size={15} aria-hidden /> {saving ? 'Saving…' : existing ? 'Save changes' : picked.length ? 'Create my habits' : 'Finish setup'}
            </button>
          ) : (
            <button type="button" onClick={() => { setError(null); setStep(step + 1); }}
                    className="flex min-h-10 items-center gap-2 btn-primary px-4 py-2.5 text-sm">
              Next <ArrowRight size={15} aria-hidden />
            </button>
          )}

          <button type="button" disabled={saving} onClick={() => void finish(true)}
                  className="min-h-10 px-3 text-sm font-semibold text-[var(--color-subtle)] underline underline-offset-4">
            Skip for now
          </button>

          {existing && (
            <Link href="/settings" className="ml-auto min-h-10 px-2 py-2.5 text-sm font-semibold text-[var(--color-subtle)]">
              Cancel
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
