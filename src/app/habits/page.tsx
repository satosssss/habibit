'use client';

import { NavShell } from '@/components/NavShell';
import { HabitsScreen } from '@/components/HabitsScreen';

export default function HabitsPage() {
  return (
    <NavShell>
      <HabitsScreen />
    </NavShell>
  );
}
