'use client';

import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ACTIVITY_LEVELS, CHALLENGE_SUGGESTIONS, TIMEFRAMES, TONES, emptyProfile, normalizeGoals,
} from '@/lib/profile';
import { getProfile, saveProfile } from '@/lib/repo';
import type { Profile } from '@/lib/types';

const STEPS = ['Lifestyle', 'Goals', 'Challenges', 'Preferences'] as const;

const inputClass = 'glass-input';
const labelClass = 'mb-1 block text-sm font-semibold';
const textareaClass = 'glass-input min-h-20 resize-y';

/**
 * Accounts spec R3: four screens, one question group each, all answers saved as
 * a single Dexie row only on Save (so Back/Next never half-write). The same
 * screen edits an existing profile, which is why it never redirects when one
 * is found — it prefills instead.
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

  const setLifestyle = <K extends keyof Profile['lifestyle']>(
    key: K, value: Profile['lifestyle'][K],
  ) => setDraft((p) => ({ ...p, lifestyle: { ...p.lifestyle, [key]: value } }));

  const setPreference = <K extends keyof Profile['preferences']>(
    key: K, value: Profile['preferences'][K],
  ) => setDraft((p) => ({ ...p, preferences: { ...p.preferences, [key]: value } }));

  const goalItems = draft.goals.items.length ? draft.goals.items : [''];
  const setGoal = (index: number, value: string) => setDraft((p) => {
    const items = [...(p.goals.items.length ? p.goals.items : [''])];
    items[index] = value;
    return { ...p, goals: { ...p.goals, items } };
  });

  const toggleChallenge = (chip: string) => setDraft((p) => {
    const parts = p.challenges.split('\n').map((line) => line.trim()).filter(Boolean);
    const next = parts.includes(chip) ? parts.filter((part) => part !== chip) : [...parts, chip];
    return { ...p, challenges: next.join('\n') };
  });

  const finish = async (skip: boolean) => {
    const goals = normalizeGoals(draft.goals.items);
    if (!skip && goals.length === 0) {
      setStep(1);
      setError('Add at least one goal — or skip for now.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveProfile({
        lifestyle: draft.lifestyle,
        goals: { ...draft.goals, items: goals },
        challenges: draft.challenges.trim(),
        preferences: draft.preferences,
        skipped: skip,
        onboardedAt: existing ? draft.onboardedAt : Date.now(),
        // Only the first save claims the device; later edits must never
        // rewrite whose data this browser holds (spec D4).
        accountEmail: existing ? undefined : email,
      });
      router.replace('/home');
    } catch {
      setSaving(false);
      setError('Could not save the profile in this browser. Try again.');
    }
  };

  if (!ready) {
    return <p role="status" className="p-10 text-center text-sm text-[var(--color-subtle)]">Loading…</p>;
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
            ? 'Answers feed your habit suggestions. Change anything, any time.'
            : 'Four short steps, then suggestions built for your actual day.'}
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

            <label className="block">
              <span className={labelClass}>Work or school schedule</span>
              <input id="onboarding-schedule" value={draft.lifestyle.schedule}
                     onChange={(e) => setLifestyle('schedule', e.target.value)}
                     placeholder="e.g. Office 9–5, classes in the morning"
                     className={inputClass} />
            </label>

            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>Activity level</legend>
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
              <span className={labelClass}>Habits you already keep</span>
              <textarea id="onboarding-current" value={draft.lifestyle.currentHabits}
                        onChange={(e) => setLifestyle('currentHabits', e.target.value)}
                        placeholder="e.g. coffee, a walk at lunch, scrolling before bed"
                        className={textareaClass} />
            </label>

            <label className="block">
              <span className={labelClass}>Biggest time sinks</span>
              <textarea id="onboarding-sinks" value={draft.lifestyle.timeSinks}
                        onChange={(e) => setLifestyle('timeSinks', e.target.value)}
                        placeholder="e.g. phone in the evening, long commute"
                        className={textareaClass} />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>Top goals (1–3)</legend>
              <div className="flex flex-col gap-2">
                {goalItems.map((goal, index) => (
                  <label key={index} className="block">
                    <span className="sr-only">Goal {index + 1}</span>
                    <input value={goal} aria-label={`Goal ${index + 1}`}
                           onChange={(e) => setGoal(index, e.target.value)}
                           placeholder={index === 0 ? 'e.g. move every day' : 'Another goal'}
                           className={inputClass} />
                  </label>
                ))}
              </div>
              {goalItems.length < 3 && (
                <button type="button"
                        onClick={() => setDraft((p) => ({
                          ...p,
                          goals: { ...p.goals, items: [...(p.goals.items.length ? p.goals.items : ['']), ''] },
                        }))}
                        className="mt-2 min-h-10 text-sm font-semibold text-[var(--color-accent-ink)]">
                  + Add another goal
                </button>
              )}
            </fieldset>

            <label className="block">
              <span className={labelClass}>Timeframe</span>
              <select value={draft.goals.timeframe}
                      onChange={(e) => setDraft((p) => ({ ...p, goals: { ...p.goals, timeframe: e.target.value } }))}
                      className={inputClass}>
                {TIMEFRAMES.map((frame) => <option key={frame} value={frame}>{frame}</option>)}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Why does this matter?</span>
              <textarea id="onboarding-why" value={draft.goals.why}
                        onChange={(e) => setDraft((p) => ({ ...p, goals: { ...p.goals, why: e.target.value } }))}
                        placeholder="One honest sentence is enough."
                        className={textareaClass} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className={labelClass}>What has made habits hard to keep?</span>
              <textarea id="onboarding-challenges" value={draft.challenges}
                        onChange={(e) => setDraft((p) => ({ ...p, challenges: e.target.value }))}
                        placeholder="Past attempts, what got in the way, when you gave up…"
                        className={`${textareaClass} min-h-28`} />
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
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className={labelClass}>Preferred reminder time</span>
              <input id="onboarding-reminder" type="time" value={draft.preferences.reminderTime}
                     onChange={(e) => setPreference('reminderTime', e.target.value)}
                     className={inputClass} />
              <span className="mt-1 block text-xs text-[var(--color-subtle)]">Leave blank for no reminder.</span>
            </label>

            <fieldset className="border-0 p-0">
              <legend className={`${labelClass} px-0`}>Coaching tone</legend>
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

            <p className="flex items-start gap-2 text-xs text-[var(--color-subtle)]">
              <Sparkles size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Your answers stay on this device. Suggestions send only your goals, routine and
                completion counts — never your name, email or photo.
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
              <Check size={15} aria-hidden /> {saving ? 'Saving…' : existing ? 'Save changes' : 'Save profile'}
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
