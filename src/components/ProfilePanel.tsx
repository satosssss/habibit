'use client';

import { Check, Pencil, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AVATARS, avatarFor } from '@/lib/avatars';
import { displayName, profileSummary } from '@/lib/profile';
import { getProfile, saveProfile } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';

/**
 * Accounts spec R2/R3 + onboarding v2: Settings shows what the device
 * remembers. Name and avatar are editable inline (cosmetic, instant); the
 * longer answers still go through the onboarding screen so they invalidate
 * the suggestion cache the same way they always did.
 */
export function ProfilePanel() {
  const profile = useLiveQuery(() => getProfile(), []);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatedAt = profile?.updatedAt ?? 0;
  useEffect(() => {
    if (!profile || editing) return;
    setName(profile.identity.displayName);
    setAvatarId(profile.identity.avatarId);
  }, [updatedAt, editing, profile]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveProfile({ identity: { displayName: name, avatarId } });
      setEditing(false);
    } catch {
      setError('Could not save that in this browser.');
    } finally {
      setSaving(false);
    }
  };

  const avatar = avatarFor(profile?.identity.avatarId);

  return (
    <section className="mt-6 glass-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-subtle)]">
        <UserRound size={14} aria-hidden /> Profile
      </h2>

      {profile === undefined ? (
        <p className="text-sm text-[var(--color-subtle)]">Loading…</p>
      ) : !profile ? (
        <>
          <p className="text-sm">No profile on this device yet. Habit ideas need one.</p>
          <Link href="/onboarding" className="mt-3 inline-flex min-h-10 items-center btn-primary px-4 py-2.5 text-sm">
            Set up your profile
          </Link>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-muted)] text-xl">
              {avatar.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {displayName(profile) || 'No name yet'}
              </p>
              <p className="text-xs text-[var(--color-subtle)]">
                {profile.accountEmail ?? 'This device'}
              </p>
            </div>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)}
                      className="ml-auto flex min-h-10 items-center gap-1.5 btn-glass px-3 py-2 text-xs font-semibold">
                <Pencil size={13} aria-hidden /> Edit
              </button>
            )}
          </div>

          {editing && (
            <div className="mt-4 flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Name</span>
                <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
                       className="glass-input" placeholder="Your first name is enough" />
              </label>
              <div>
                <span className="mb-1 block text-sm font-semibold">Face</span>
                <div className="grid grid-cols-6 gap-2">
                  {AVATARS.map((option) => (
                    <button key={option.id} type="button" aria-pressed={avatarId === option.id}
                            aria-label={option.label} title={option.label}
                            onClick={() => setAvatarId(option.id)}
                            className={`grid aspect-square min-h-11 place-items-center rounded-xl border text-lg ${
                              avatarId === option.id
                                ? 'border-[var(--color-accent)] bg-[var(--color-muted)]'
                                : 'border-[var(--color-line)]'
                            }`}>
                      <span aria-hidden>{option.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={saving} onClick={() => void save()}
                        className="flex min-h-10 items-center gap-2 btn-primary px-4 py-2.5 text-sm">
                  <Check size={15} aria-hidden /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditing(false)}
                        className="min-h-10 px-3 text-sm font-semibold text-[var(--color-subtle)]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <ul className="mt-4 flex flex-col gap-1 text-sm">
            {profileSummary(profile).filter((line) => !line.startsWith('Name:')).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {profile.skipped && (
            <p className="mt-2 text-xs text-[var(--color-subtle)]">
              You skipped setup — add your goals for better ideas.
            </p>
          )}
          <Link href="/onboarding" className="mt-3 inline-flex min-h-10 items-center btn-glass px-4 py-2.5 text-sm font-semibold">
            Edit profile
          </Link>
        </>
      )}
    </section>
  );
}
