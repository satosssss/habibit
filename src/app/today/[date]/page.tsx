'use client';

import { useEffect, useState, use } from 'react';
import { redirect } from 'next/navigation';
import { NavShell } from '@/components/NavShell';
import { NoteScreen } from '@/components/NoteScreen';
import { TodayScreen } from '@/components/TodayScreen';
import { classifyDate, isValidDateKey, todayKey } from '@/lib/dates';

export default function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  // URL-deterministic checks run first (malformed/future keys redirect during
  // the very first render, server or client). The *clock*-dependent branch
  // stays gated: prerendered HTML must be clock-independent, so under Vercel's
  // UTC SSR the local-midnight window can never pick the wrong screen —
  // SSR/first client render is just the shell, and the effect flips it on.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isValidDateKey(date)) redirect('/today');
  if (classifyDate(date, todayKey()) === 'future') redirect('/today');

  if (!mounted) return <NavShell>{null}</NavShell>;
  return (
    <NavShell>
      {classifyDate(date, todayKey()) === 'past' ? <NoteScreen date={date} /> : <TodayScreen date={date} />}
    </NavShell>
  );
}
