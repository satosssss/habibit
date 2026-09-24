'use client';

import { use } from 'react';
import { redirect } from 'next/navigation';
import { NavShell } from '@/components/NavShell';
import { NoteScreen } from '@/components/NoteScreen';
import { TodayScreen } from '@/components/TodayScreen';
import { classifyDate, isValidDateKey, todayKey } from '@/lib/dates';

export default function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const today = todayKey();

  if (!isValidDateKey(date) || classifyDate(date, today) === 'future') redirect('/today');

  return (
    <NavShell>
      {classifyDate(date, today) === 'past' ? <NoteScreen date={date} /> : <TodayScreen date={date} />}
    </NavShell>
  );
}
