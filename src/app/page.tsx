'use client';

import { NavShell } from '@/components/NavShell';
import { HomeScreen } from '@/components/HomeScreen';

export default function HomePage() {
  return (
    <NavShell>
      <HomeScreen />
    </NavShell>
  );
}
