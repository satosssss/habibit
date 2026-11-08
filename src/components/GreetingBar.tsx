'use client';

import { useEffect, useState } from 'react';
import { avatarFor } from '@/lib/avatars';
import { displayName, greeting } from '@/lib/profile';
import { getProfile } from '@/lib/repo';
import { useLiveQuery } from '@/lib/useLiveQuery';

/**
 * The "this app knows me" line. Renders only once mounted so prerendered HTML
 * never freezes a greeting (or the build machine's clock) into the page.
 */
export function GreetingBar() {
  const profile = useLiveQuery(() => getProfile(), []);
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => setHour(new Date().getHours()), []);

  if (!profile || hour === null) return null;
  const name = displayName(profile);
  if (!name) return null;

  const avatar = avatarFor(profile.identity.avatarId);

  return (
    <div className="mb-1 flex items-center gap-3 px-2">
      <span aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-muted)] text-lg">
        {avatar.emoji}
      </span>
      <p className="text-sm font-semibold">{greeting(profile, hour)}</p>
    </div>
  );
}
