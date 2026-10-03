'use client';

import { useEffect, useState, use } from 'react';
import { redirect } from 'next/navigation';
import { NavShell } from '@/components/NavShell';
import { NoteScreen } from '@/components/NoteScreen';
import { HomeScreen } from '@/components/HomeScreen';
import { classifyDate, isValidDateKey, todayKey } from '@/lib/dates';

export default function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  // URL-deterministic checks run first: a malformed key redirects during the
  // very first render, server or client. One exception to "clock-dependent
  // stays gated" — the future-key check below IS clock-dependent and also
  // runs pre-mount on server and client, deliberately: page.test pins that a
  // future date redirects on the first render, and an east-of-UTC client's
  // local tomorrow checked against Vercel's UTC SSR clock around midnight
  // redirects to /, which renders Home — the same screen. What stays
  // gated is the *screen choice*: prerendered HTML must be clock-independent,
  // so under UTC SSR the local-midnight window can never freeze the wrong
  // screen — SSR/first client render is just the shell, and the effect flips
  // it on.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isValidDateKey(date)) redirect('/');
  if (classifyDate(date, todayKey()) === 'future') redirect('/');

  if (!mounted) return <NavShell>{null}</NavShell>;
  return (
    <NavShell>
      {classifyDate(date, todayKey()) === 'past' ? <NoteScreen date={date} /> : <HomeScreen date={date} />}
    </NavShell>
  );
}
